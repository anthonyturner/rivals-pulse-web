import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * No database runs in this repo's tests; `supabase/checks/app_link_calls.sql` proves the rules
 * against the linked project. These read the SQL for the posture that is easy to break and expensive
 * to find in production.
 */
const sql = readFileSync(new URL('../../migrations/20261101050000_app_link_status.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

const functionBody = (name: string) =>
  sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] ?? '';

const FUNCTIONS = ['link_status_for_recorder', 'unlink_player_for_recorder'];

describe('20261101050000_app_link_status.sql', () => {
  it('lets only the service role call the new functions', () => {
    for (const name of FUNCTIONS) {
      const grants = [...sql.matchAll(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to (\\w+)`, 'g'))].map(match => match[1]);
      assert.deepEqual(grants, ['service_role'], name);
      assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`), name);
    }
    assert.doesNotMatch(sql, /\bgrant (select|insert|update|delete|all)\b/i);
  });

  it('runs both as definer with an empty search path, keyed on the recorder and never on auth.uid()', () => {
    for (const name of FUNCTIONS) {
      const body = functionBody(name);
      assert.match(body, /security definer/, name);
      assert.match(body, /set search_path = ''/, name);
      assert.match(body, /where recorder_id = p_recorder_id/, name);
      assert.doesNotMatch(body, /auth\.uid|auth\.jwt|p_user/, name);
    }
  });

  it('reads only the player name and the link date, never the account', () => {
    const body = functionBody('link_status_for_recorder');
    assert.match(body, /select player_name, linked_at into found_name, found_at\s+from public\.player_links/);
    assert.doesNotMatch(body, /user_id|auth\.users|email|select \*/);
    assert.doesNotMatch(body, /jsonb_build_object\([^;]*(user|email|recorder)/i);
  });

  it('deletes only the recorder\'s own row, under the lock a re-link takes', () => {
    const body = functionBody('unlink_player_for_recorder');
    assert.equal(body.match(/delete from public\.player_links/g)?.length, 1);
    assert.match(body, /delete from public\.player_links where recorder_id = p_recorder_id;/);
    assert.match(body, /hashtextextended\('recorder:' \|\| p_recorder_id, 0\)/);
  });

  it('limits each by its own kind through the shared limiter, before doing anything', () => {
    assert.match(functionBody('link_status_for_recorder'), /take_link_app_call\('status', p_recorder_id, p_limit\)/);
    assert.match(functionBody('unlink_player_for_recorder'), /take_link_app_call\('unlink', p_recorder_id, p_limit\)/);
  });

  it('adds the two kinds to the log and keeps the earlier ones', () => {
    assert.match(sql, /check \(kind in \('issue', 'redeem_failed', 'refresh', 'status', 'unlink'\)\)/);
  });

  it('declares every function once, and changes nothing the overlay calls', () => {
    const names = [...sql.matchAll(/create or replace function (public\.\w+)\(/g)].map(match => match[1]);
    assert.deepEqual(names, FUNCTIONS.map(name => `public.${name}`));
    assert.doesNotMatch(sql, /\b(participants|tracked_matches|players|record_match_participants|claim_upload_slot)\b/);
  });
});
