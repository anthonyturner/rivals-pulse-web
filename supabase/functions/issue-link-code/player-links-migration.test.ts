import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The linking migration cannot be run by this repo's tests (no database here); `supabase/checks/
 * player_links.sql` proves its rules against the linked project. These read the SQL for the posture
 * that is easy to break and expensive to find in production.
 */
const sql = readFileSync(new URL('../../migrations/20261101020000_player_links.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

const TABLES = ['player_links', 'link_codes', 'link_attempt_log'];

describe('20261101020000_player_links.sql', () => {
  it('turns row level security on for every table and takes the API roles\' rights away', () => {
    for (const table of TABLES) {
      assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`), table);
      assert.match(sql, new RegExp(`revoke all on public\\.${table} from anon, authenticated`), table);
    }
  });

  it('lets an account select only its own link, and nothing else is granted to a client', () => {
    assert.match(sql, /grant select on public\.player_links to authenticated/);
    assert.equal(sql.match(/create policy/g)?.length, 1);
    assert.match(sql, /on public\.player_links for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/);
    assert.doesNotMatch(sql, /grant (insert|update|delete|all)[^;]* on public\.\w+ to/i);
    assert.doesNotMatch(sql, /grant [^;]* to [^;]*\banon\b/i);
  });

  it('makes the recorder unique and the account the key, and removes the link with the account', () => {
    assert.match(sql, /user_id uuid primary key references auth\.users \(id\) on delete cascade/);
    assert.match(sql, /recorder_id text not null unique/);
    assert.doesNotMatch(sql, /player_uid text not null unique/);
  });

  it('stores only https avatar addresses', () => {
    assert.equal(sql.match(/avatar_url is null or avatar_url like 'https:\/\/%'/g)?.length, 2);
  });

  it('keeps one code per recorder and stores only its hash', () => {
    assert.match(sql, /recorder_id text primary key,\s+code_hash text not null unique/);
    assert.doesNotMatch(sql, /\bcode text\b/);
  });

  it('lets only the service role issue codes, and only signed-in accounts redeem or unlink', () => {
    const grants = (name: string) => [...sql.matchAll(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to (\\w+)`, 'g'))].map(match => match[1]);
    assert.deepEqual(grants('issue_link_code'), ['service_role']);
    assert.deepEqual(grants('link_code_hash'), ['service_role']);
    assert.deepEqual(grants('redeem_link_code'), ['authenticated']);
    assert.deepEqual(grants('unlink_player'), ['authenticated']);
    assert.deepEqual(grants('purge_link_data'), ['service_role']);
    for (const name of ['issue_link_code', 'link_code_hash', 'redeem_link_code', 'unlink_player', 'purge_link_data']) {
      assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`), name);
    }
  });

  it('runs the functions that act for an account as definer, keyed on auth.uid() and with an empty search path', () => {
    for (const name of ['redeem_link_code', 'unlink_player']) {
      const body = sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] ?? '';
      assert.match(body, /security definer/, name);
      assert.match(body, /set search_path = ''/, name);
      assert.match(body, /\(select auth\.uid\(\)\)/, name);
      assert.doesNotMatch(body, /p_user|p_account/, name);
    }
  });

  it('schedules the purge that enforces the retention the privacy notes promise', () => {
    assert.match(sql, /cron\.schedule\('purge-link-data', '\*\/5 \* \* \* \*', 'select public\.purge_link_data\(\)'\)/);
    const purge = sql.match(/create or replace function public\.purge_link_data\([\s\S]*?\n\$\$;/)?.[0] ?? '';
    assert.match(purge, /delete from public\.link_attempt_log/);
    assert.match(purge, /delete from public\.link_codes where expires_at < now\(\)/);
  });

  it('deletes a wrong-code attempt with its account, and refuses anonymous sessions', () => {
    assert.match(sql, /user_id uuid references auth\.users \(id\) on delete cascade/);
    assert.match(sql, /values \('redeem_failed', account::text, account\)/);
    assert.match(sql, /auth\.jwt\(\)\) ->> 'is_anonymous'/);
  });

  it('declares every function once, so a later restatement cannot add an overload', () => {
    const names = [...sql.matchAll(/create or replace function (public\.\w+)\(/g)].map(match => match[1]);
    assert.equal(new Set(names).size, names.length);
  });

  it('changes nothing the overlay calls', () => {
    assert.doesNotMatch(sql, /\b(participants|tracked_matches|players|record_match_participants|claim_upload_slot)\b/);
  });
});
