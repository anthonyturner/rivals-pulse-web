import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * No database runs in this repo's tests; `supabase/checks/app_link_calls.sql` proves the rules
 * against the linked project. These read the SQL for the posture that is easy to break and expensive
 * to find in production.
 */
const sql = readFileSync(new URL('../../migrations/20261101040000_refresh_linked_player.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

const functionBody = (name: string) =>
  sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] ?? '';

describe('20261101040000_refresh_linked_player.sql', () => {
  it('lets only the service role call the new functions', () => {
    for (const name of ['take_link_app_call', 'refresh_linked_player', 'purge_link_data']) {
      const grants = [...sql.matchAll(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to (\\w+)`, 'g'))].map(match => match[1]);
      assert.deepEqual(grants, ['service_role'], name);
      assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`), name);
    }
  });

  it('grants no table right to anyone', () => {
    assert.doesNotMatch(sql, /\bgrant (select|insert|update|delete|all)\b/i);
  });

  it('runs the refresh as definer with an empty search path', () => {
    const body = functionBody('refresh_linked_player');
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
  });

  it('sets the name and avatar of the recorder\'s link and nothing else', () => {
    const body = functionBody('refresh_linked_player');
    assert.equal(body.match(/update public\.player_links/g)?.length, 1);
    const assigned = body.match(/update public\.player_links\s+set ([\s\S]*?)\s+where recorder_id = p_recorder_id;/)?.[1];
    assert.equal(assigned, 'player_name = p_player_name, avatar_url = p_avatar_url');
  });

  it('never creates, moves or deletes a link', () => {
    const body = functionBody('refresh_linked_player');
    assert.doesNotMatch(body, /insert into public\.player_links|delete from public\.player_links/);
    assert.doesNotMatch(body, /\bp_player_uid\b|\bp_user_id\b/);
  });

  it('takes the lock redeem_link_code takes, so a refresh cannot land halfway through a re-link', () => {
    assert.match(functionBody('refresh_linked_player'), /hashtextextended\('recorder:' \|\| p_recorder_id, 0\)/);
  });

  it('counts calls per kind and recorder over the shared hour window, and does not log a refused one', () => {
    const body = functionBody('take_link_app_call');
    assert.match(body, /kind = p_kind and subject = p_recorder_id and attempted_at > now\(\) - public\.link_issue_window\(\)/);
    assert.ok(body.indexOf('return greatest(1') < body.indexOf('insert into public.link_attempt_log'));
  });

  it('adds the refresh kind to the log without dropping an existing one', () => {
    assert.match(sql, /check \(kind in \('issue', 'redeem_failed', 'refresh'\)\)/);
  });

  it('keeps the purge on both windows and ages out every non-lockout kind by the hour', () => {
    const body = functionBody('purge_link_data');
    assert.match(body, /kind <> 'redeem_failed' and attempted_at < now\(\) - public\.link_issue_window\(\)/);
    assert.match(body, /kind = 'redeem_failed' and attempted_at < now\(\) - public\.link_lockout_window\(\)/);
    assert.match(body, /delete from public\.link_codes where expires_at < now\(\)/);
  });

  it('declares every function once, and changes nothing the overlay calls', () => {
    const names = [...sql.matchAll(/create or replace function (public\.\w+)\(/g)].map(match => match[1]);
    assert.equal(new Set(names).size, names.length);
    assert.doesNotMatch(sql, /\b(participants|tracked_matches|players|record_match_participants|claim_upload_slot)\b/);
  });
});
