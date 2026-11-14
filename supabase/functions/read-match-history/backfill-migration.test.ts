import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * No database runs in this repo's tests; `supabase/checks/backfill_tracked_match_recorders.sql` proves
 * the rule against the linked project. These read the SQL for the parts that are easy to break and
 * expensive to find in production.
 */
const sql = readFileSync(new URL('../../migrations/20261109100000_backfill_tracked_match_recorders.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

describe('20261109100000_backfill_tracked_match_recorders.sql', () => {
  it('only adds recorder rows: it never updates or deletes one, and never touches the match tables', () => {
    assert.doesNotMatch(sql, /\b(update|delete)\b/i);
    assert.match(sql, /insert into public\.tracked_match_recorders \(tracked_match_id, recorded_by, recorded_at\)/);
    assert.doesNotMatch(sql, /\b(alter|drop|create)\s+(table|policy)\b/i);
    assert.doesNotMatch(sql, /insert into public\.(players|tracked_matches)\b/i);
  });

  it('ties a match only to the sole recorder of its player, and never replaces a recorder it already has', () => {
    assert.match(sql, /group by tm\.player_id\s+having count\(distinct r\.recorded_by\) = 1/);
    assert.match(sql, /join sole_recorder sole on sole\.player_id = tm\.player_id/);
    assert.match(sql, /where not exists \(\s+select 1 from public\.tracked_match_recorders r where r\.tracked_match_id = tm\.id\s+\)/);
    assert.match(sql, /on conflict \(tracked_match_id\) do nothing/);
  });

  it('leaves a match whose own uid is not one the recorded matches carry untied', () => {
    assert.match(sql, /tm\.performance ->> 'player_uid' is null\s+or tm\.performance ->> 'player_uid' = any \(sole\.uids\)/);
  });

  it('keeps the time the match was written, and never reads the recorder from a name', () => {
    assert.match(sql, /select tm\.id, sole\.recorder, tm\.recorded_at/);
    assert.doesNotMatch(sql, /normalized_name|player_name|provider_player_uid/);
  });

  it('runs as definer with an empty search path, for the service role only, and runs once', () => {
    assert.match(sql, /security definer/);
    assert.match(sql, /set search_path = ''/);
    assert.match(sql, /revoke execute on function public\.backfill_tracked_match_recorders\(\) from public, anon, authenticated/);
    assert.deepEqual(
      [...sql.matchAll(/grant execute on function public\.backfill_tracked_match_recorders\(\) to (\w+)/g)].map(match => match[1]),
      ['service_role'],
    );
    assert.equal([...sql.matchAll(/^select public\.backfill_tracked_match_recorders\(\);$/gm)].length, 1);
  });
});
