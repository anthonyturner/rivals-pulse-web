import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MAX_TIMELINE_PICKS, MAX_TIMELINE_PLAYERS } from './extended-payload.ts';
import { columnsOf, createdFunctions, createdTables, escapeRegExp, MIGRATIONS, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the hero timelines migration (issue 654)
 * for the rules that are easy to break and expensive to find in production: the posture of the new
 * table, that no player is named, that a match's timelines are stored once, and that the restated
 * purge still freezes every family and now deletes the timelines.
 */
const TIMELINES = '20261108180000_match_hero_timelines.sql';
const UPLOAD = '20261030120000_extended_upload.sql';
const EARLIER_PURGE = '20261107120000_triple_support_trios.sql';

const sql = withoutComments(read(TIMELINES));
const bodyOf = (text: string, name: string): string => {
  const start = text.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, name);
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

describe('the hero timelines migration', () => {
  it('turns row level security on for its table, with no policy and grants only to the service role', () => {
    assert.deepEqual(createdTables(sql), ['public.match_hero_timelines']);
    assert.match(sql, /alter table public\.match_hero_timelines enable row level security/);
    assert.match(sql, /revoke all on public\.match_hero_timelines from anon, authenticated/);
    assert.match(sql, /grant select, insert, update, delete on public\.match_hero_timelines to service_role/);
    assert.match(sql, /revoke all on sequence public\.match_hero_timelines_id_seq from anon, authenticated/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('revokes execute from everyone and grants it to the service role for every function', () => {
    const functions = createdFunctions(sql);
    assert.ok(functions.includes('public.record_match_hero_timelines(text, timestamptz, jsonb)'));
    assert.ok(functions.includes('public.purge_expired_participants()'));
    for (const signature of functions) {
      const escaped = escapeRegExp(signature);
      assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`), signature);
      assert.match(sql, new RegExp(`grant execute on function ${escaped} to service_role;`), signature);
    }
    assert.doesNotMatch(sql, /grant execute [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('keeps a pick by match, team and hero, with no uid, name or recorder', () => {
    const columns = columnsOf(read(TIMELINES), 'public.match_hero_timelines');

    assert.deepEqual(columns, ['id', 'fingerprint', 'half_season', 'played_at', 'team', 'timeline_no', 'pick_no', 'hero_id', 'at_second', 'recorded_at']);
    for (const column of columns) assert.doesNotMatch(column, /uid|name|recorded_by|participant|player/, column);
  });

  it('keys a match like the kill feed: roster fingerprint plus start time', () => {
    assert.match(sql, /unique \(fingerprint, played_at, timeline_no, pick_no\)/);
    assert.deepEqual(columnsOf(read(UPLOAD), 'public.match_hero_kills').slice(1, 4), ['fingerprint', 'half_season', 'played_at']);
  });

  it('holds the same limits as the Edge Function in the table and the writer', () => {
    assert.match(sql, new RegExp(`timeline_no smallint not null check \\(timeline_no between 1 and ${MAX_TIMELINE_PLAYERS}\\)`));
    assert.match(sql, new RegExp(`pick_no smallint not null check \\(pick_no between 1 and ${MAX_TIMELINE_PICKS}\\)`));
    assert.match(sql, new RegExp(`jsonb_array_length\\(p_hero_timelines\\) not between 1 and ${MAX_TIMELINE_PLAYERS}`));
    assert.match(sql, new RegExp(`having count\\(\\*\\) between 1 and ${MAX_TIMELINE_PICKS}`));
    assert.match(sql, /at_second integer not null check \(at_second between 0 and 7200\)/);
  });

  it('stores the timelines of a match once, whoever uploaded it: the first uploader wins', () => {
    const writer = bodyOf(sql, 'record_match_hero_timelines');

    assert.match(writer, /pg_advisory_xact_lock\(hashtextextended\(p_fingerprint, 3\)\)/);
    assert.match(writer, /if exists \(\s*select 1 from public\.match_hero_timelines t\s+where t\.fingerprint = p_fingerprint and t\.played_at = match_played_at\s*\) then\s+return 0;/);
    assert.match(writer, /on conflict \(fingerprint, played_at, timeline_no, pick_no\) do nothing/);
    assert.ok(writer.indexOf('pg_advisory_xact_lock') < writer.indexOf('if exists'), 'the lock must come before the check');
  });

  it('stores nothing for a match nobody recorded, using the four minute window the scoreboard uses', () => {
    const writer = bodyOf(sql, 'record_match_hero_timelines');

    assert.match(writer, /p\.played_at between p_played_at - interval '4 minutes' and p_played_at \+ interval '4 minutes'/);
    assert.match(writer, /if not found then\s+return 0;/);
  });

  it('stores a timeline whole or not at all, and never lets a bad value raise', () => {
    const writer = bodyOf(sql, 'record_match_hero_timelines');

    assert.match(writer, /bool_and\(o\.team is not null and o\.hero_id is not null and o\.at_second is not null and o\.in_order\)/);
    assert.match(writer, /lag\(k\.at_second\) over \(partition by k\.timeline_no order by k\.pick_no\)/);
    assert.doesNotMatch(writer, /::(smallint|integer|int)\b/);
    assert.match(bodyOf(sql, 'json_whole_number'), /immutable\s+set search_path = ''/);
  });

  it('only adds: no existing table or function signature is changed', () => {
    assert.doesNotMatch(sql, /\balter table (?!public\.match_hero_timelines enable)/i);
    assert.doesNotMatch(sql, /\bdrop (table|column|function)\b/i);
    assert.doesNotMatch(sql, /function public\.(record_match_participants|record_match_extras|record_match_ability_uses)\b/);
  });
});

describe('the purge after the hero timelines migration', () => {
  const body = bodyOf(sql, 'purge_expired_participants');
  const earlier = bodyOf(withoutComments(read(EARLIER_PURGE)), 'purge_expired_participants');
  const timelinesDelete = /delete from public\.match_hero_timelines t\s+where public\.participants_past_retention\(t\.half_season, t\.played_at\);/;

  it('is the earlier purge with only the timelines delete added, so every freeze is still called first', () => {
    assert.match(body, timelinesDelete);
    assert.equal(squash(body.replace(timelinesDelete, '')), squash(earlier));

    const firstDelete = body.indexOf('delete from');
    for (const freeze of [
      'public.rebuild_hero_aggregates(',
      'public.freeze_extended_aggregates()',
      'public.freeze_hero_pair_aggregates()',
      'public.freeze_triple_support_aggregates()',
    ]) {
      const at = body.indexOf(freeze);
      assert.ok(at >= 0 && at < firstDelete, freeze);
    }
  });

  it('deletes timelines on the schedule of the kill feed', () => {
    assert.match(body, /delete from public\.match_hero_kills k\s+where public\.participants_past_retention\(k\.half_season, k\.played_at\);/);
    assert.match(body, timelinesDelete);
  });

  it('is only restated later by the switch-in migration, which adds a freeze and nothing else', () => {
    const later = readdirSync(MIGRATIONS)
      .filter(name => name > TIMELINES && withoutComments(read(name)).includes('function public.purge_expired_participants('));
    assert.deepEqual(later, ['20261108190000_hero_switch_in_aggregates.sql']);
  });
});
