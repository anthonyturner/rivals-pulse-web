import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * No database runs in this repo's tests; `supabase/checks/verified_match_history_reads.sql` proves the
 * rules against the linked project. These read the SQL for the posture that is easy to break and
 * expensive to find in production.
 */
const sql = readFileSync(new URL('../../migrations/20261109000000_verified_match_history_reads.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

const functionBody = (name: string) =>
  sql.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`))?.[0] ?? '';

const FUNCTIONS = ['read_own_tracked_matches', 'read_player_scoreboard_lines'];

describe('20261109000000_verified_match_history_reads.sql', () => {
  it('lets only the service role call the new functions, and grants no table', () => {
    for (const name of FUNCTIONS) {
      const grants = [...sql.matchAll(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to (\\w+)`, 'g'))].map(match => match[1]);
      assert.deepEqual(grants, ['service_role'], name);
      assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\([^)]*\\) from public, anon, authenticated`), name);
    }
    assert.doesNotMatch(sql, /\bgrant (select|insert|update|delete|all)\b/i);
  });

  it('leaves the overlay-facing tables and their policies alone', () => {
    assert.doesNotMatch(sql, /\b(alter|drop|create)\s+(table|policy)\b[^;]*\b(players|player_matches|tracked_matches)\b/i);
    assert.doesNotMatch(sql, /\brevoke\b[^;]*\bon (public\.)?(players|player_matches|tracked_matches)\b/i);
  });

  it('runs both as definer with an empty search path, rate limited before anything else', () => {
    for (const [name, kind] of [['read_own_tracked_matches', 'history'], ['read_player_scoreboard_lines', 'scoreboard']]) {
      const body = functionBody(name);
      assert.match(body, /security definer/, name);
      assert.match(body, /set search_path = ''/, name);
      assert.match(body, new RegExp(`wait integer := public\\.take_link_app_call\\('${kind}', p_recorder_id, p_limit\\)`), name);
      const firstRead = body.indexOf('public.tracked_match');
      assert.ok(firstRead > 0 && body.indexOf('if wait > 0') < firstRead, name);
      assert.doesNotMatch(body, /auth\.uid|auth\.jwt/, name);
    }
  });

  it('lets the limiter count the two new kinds, keeping every earlier one', () => {
    assert.match(sql, /check \(kind in \('issue', 'redeem_failed', 'refresh', 'status', 'unlink', 'history', 'scoreboard'\)\)/);
  });

  it("returns a recorder's own uploads only, found through the recorder table, never by name", () => {
    const body = functionBody('read_own_tracked_matches');
    assert.match(body, /join public\.tracked_matches tm on tm\.id = r\.tracked_match_id\s+where r\.recorded_by = p_recorder_id/);
    assert.doesNotMatch(body, /normalized_name|public\.players/);
    assert.match(body, /limit least\(greatest\(coalesce\(p_max, 0\), 0\), 200\)/);
  });

  it('answers a scoreboard with the match key and three figures, and no name or uploader', () => {
    const body = functionBody('read_player_scoreboard_lines');
    assert.match(body, /'matchUid', picked\.match_uid,\s+'kills', picked\.line -> 'kills',\s+'deaths', picked\.line -> 'deaths',\s+'assists', picked\.line -> 'assists'\s+\)/);
    assert.doesNotMatch(body, /recorded_by|normalized_name|nick_name|player_name|public\.players/);
  });
});
