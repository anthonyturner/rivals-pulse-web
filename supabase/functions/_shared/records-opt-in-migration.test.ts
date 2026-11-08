import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { MIGRATIONS, read, withoutComments } from '../track-match-history/migration-sql.ts';

/**
 * The switch cannot be run by this repo's tests (no database here);
 * `supabase/checks/records_opt_in.sql` proves its rules against the linked project. These read the SQL
 * for the posture that is easy to break and expensive to find in production: who may call what, what the
 * function writes, and which events switch the setting back off.
 */
const MIGRATION = '20261107110000_records_opt_in.sql';
const sql = withoutComments(read(MIGRATION));

const setter = sql.match(/create or replace function public\.set_records_opt_in\(p_show boolean\)[\s\S]*?\n\$\$;/)?.[0] ?? '';
const resetter = sql.match(/create or replace function public\.reset_records_opt_in\(\)[\s\S]*?\n\$\$;/)?.[0] ?? '';

describe(MIGRATION, () => {
  it('adds the two functions and one trigger, and no table', () => {
    assert.ok(setter, 'set_records_opt_in was not found');
    assert.ok(resetter, 'reset_records_opt_in was not found');
    assert.doesNotMatch(sql, /create table|alter table/i);
    assert.equal(sql.match(/create trigger/g)?.length, 1);
  });

  it('runs both functions as definer with an empty search path, so nothing they name can be swapped', () => {
    for (const body of [setter, resetter]) {
      assert.match(body, /security definer/);
      assert.match(body, /set search_path = ''/);
      assert.equal(body.match(/search_path/g)?.length, 1);
    }
  });

  it('lets a signed-in account call the switch and nobody else', () => {
    const revoked = sql.match(/revoke execute on function public\.set_records_opt_in\(boolean\) from ([^;]*);/)?.[1] ?? '';

    assert.deepEqual(revoked.split(',').map((role) => role.trim()).sort(), ['anon', 'authenticated', 'public', 'service_role']);
    assert.deepEqual(
      [...sql.matchAll(/grant execute on function public\.set_records_opt_in\(boolean\) to (\w+)/g)].map((match) => match[1]),
      ['authenticated'],
    );
  });

  it('closes the reset function to every API role', () => {
    const revoked = sql.match(/revoke execute on function public\.reset_records_opt_in\(\) from ([^;]*);/)?.[1] ?? '';

    assert.deepEqual(revoked.split(',').map((role) => role.trim()).sort(), ['anon', 'authenticated', 'public', 'service_role']);
    assert.doesNotMatch(sql, /grant execute on function public\.reset_records_opt_in/);
    assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|public|service_role)\b/i);
  });

  it('acts on the caller and takes no account id, so it cannot name another account', () => {
    assert.match(setter, /account uuid := \(select auth\.uid\(\)\)/);
    assert.match(setter, /values \(account, p_show, now\(\)\)/);
    assert.doesNotMatch(setter, /p_user|p_account|user_id uuid/);
  });

  it('refuses a caller with no account and an empty choice', () => {
    assert.match(setter, /if account is null then\s+raise exception [^;]*errcode = '28000'/);
    assert.match(setter, /if p_show is null then\s+raise exception [^;]*errcode = '22004'/);
  });

  it('needs a link to turn on, holds it while it writes, and always allows turning off', () => {
    assert.match(setter, /perform 1 from public\.player_links where user_id = account for share/);
    assert.match(setter, /if p_show and not found then\s+return jsonb_build_object\('status', 'not_linked'\)/);
  });

  it('sets updated_at on both a first write and a change, because the table has no trigger', () => {
    assert.match(setter, /insert into public\.account_settings \(user_id, show_in_records, updated_at\)/);
    assert.match(setter, /do update\s+set show_in_records = excluded\.show_in_records, updated_at = now\(\)/);
    assert.match(resetter, /set show_in_records = false, updated_at = now\(\)/);
  });

  it('answers with the status and the saved choice only', () => {
    assert.deepEqual(
      [...setter.matchAll(/jsonb_build_object\(([^)]*)\)/g)].map((match) => match[1]),
      ["'status', 'not_linked'", "'status', 'saved', 'showInRecords', p_show"],
    );
  });

  it('switches the setting off for the account whose link row is deleted, on every path that deletes it', () => {
    assert.match(resetter, /where user_id = old\.user_id and show_in_records/);
    assert.match(sql, /create trigger player_links_reset_records_opt_in\s+after delete on public\.player_links\s+for each row execute function public\.reset_records_opt_in\(\)/);
  });

  it('never switches a setting on, and writes nothing but the one table', () => {
    assert.doesNotMatch(resetter, /show_in_records = true/);
    assert.deepEqual(
      [...sql.matchAll(/\b(?:insert into|update|delete from) (public\.\w+)/g)].map((match) => match[1]),
      ['public.account_settings', 'public.account_settings'],
    );
  });
});

describe('the migration order', () => {
  it('comes after the settings table and the read, which are not edited here', () => {
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();

    assert.ok(files.indexOf('20261107100000_account_settings.sql') < files.indexOf(MIGRATION));
    assert.ok(files.indexOf('20261107100100_pulse_records_read.sql') < files.indexOf(MIGRATION));
  });
});
