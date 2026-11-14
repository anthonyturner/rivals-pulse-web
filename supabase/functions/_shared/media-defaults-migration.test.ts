import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { MIGRATIONS, read, withoutComments } from '../track-match-history/migration-sql.ts';

/**
 * `supabase/checks/media_defaults.sql` proves the rules against the linked project. These read the SQL
 * for the posture that is easy to break and expensive to find in production: who may call the function,
 * what it writes, and that the table stays closed to every client.
 */
const MIGRATION = '20261109120000_media_defaults.sql';
const sql = withoutComments(read(MIGRATION));

const setter = sql.match(/create or replace function public\.set_media_defaults\([^)]*\)[\s\S]*?\n\$\$;/)?.[0] ?? '';

describe(MIGRATION, () => {
  it('adds two columns to the settings table, off by default, and creates no table', () => {
    assert.doesNotMatch(sql, /create table/i);
    assert.deepEqual(
      [...sql.matchAll(/add column if not exists (\w+) boolean not null default false/g)].map((match) => match[1]),
      ['hero_video_default', 'sound_default'],
    );
    assert.equal(sql.match(/alter table/gi)?.length, 1);
  });

  it('opens the table to no one: no grant, policy or row level security change is made for it', () => {
    assert.doesNotMatch(sql, /\bgrant\b[^;]*\bon public\.account_settings/i);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /disable row level security/i);
  });

  it('runs as definer with an empty search path, so nothing it names can be swapped', () => {
    assert.ok(setter, 'set_media_defaults was not found');
    assert.match(setter, /security definer/);
    assert.match(setter, /set search_path = ''/);
    assert.equal(setter.match(/search_path/g)?.length, 1);
  });

  it('lets a signed-in account call it and nobody else', () => {
    const revoked = sql.match(/revoke execute on function public\.set_media_defaults\(boolean, boolean\) from ([^;]*);/)?.[1] ?? '';

    assert.deepEqual(revoked.split(',').map((role) => role.trim()).sort(), ['anon', 'authenticated', 'public', 'service_role']);
    assert.deepEqual(
      [...sql.matchAll(/grant execute on function public\.set_media_defaults\(boolean, boolean\) to (\w+)/g)].map((match) => match[1]),
      ['authenticated'],
    );
  });

  it('acts on the signed-in account alone: it takes no account id and refuses a caller with none', () => {
    assert.doesNotMatch(setter.match(/function public\.set_media_defaults\([^)]*\)/)?.[0] ?? '', /uuid|user/);
    assert.match(setter, /account uuid := \(select auth\.uid\(\)\)/);
    assert.match(setter, /if account is null then\s+raise exception [^;]*errcode = '28000'/);
    assert.match(setter, /if p_hero_video is null and p_sound is null then\s+raise exception [^;]*errcode = '22004'/);
  });

  it('writes only the caller\'s row, leaves the setting it was not given, and sets updated_at itself', () => {
    assert.deepEqual(
      [...setter.matchAll(/\b(?:insert into|update|delete from) (public\.\w+)/g)].map((match) => match[1]),
      ['public.account_settings'],
    );
    assert.match(setter, /values \(account, coalesce\(p_hero_video, false\), coalesce\(p_sound, false\), now\(\)\)/);
    assert.match(setter, /hero_video_default = coalesce\(p_hero_video, settings\.hero_video_default\)/);
    assert.match(setter, /sound_default = coalesce\(p_sound, settings\.sound_default\)/);
    assert.match(setter, /updated_at = now\(\)/);
    assert.doesNotMatch(setter, /show_in_records/);
  });

  it('answers with the status and the two stored values only', () => {
    assert.deepEqual(
      [...setter.matchAll(/jsonb_build_object\(([^)]*)\)/g)].map((match) => match[1]),
      ["'status', 'saved', 'heroVideo', stored_video, 'sound', stored_sound"],
    );
  });
});

describe('the migration order', () => {
  it('comes after the settings table, which is not edited here', () => {
    const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort();

    assert.ok(files.indexOf('20261107100000_account_settings.sql') < files.indexOf(MIGRATION));
  });
});
