import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createdFunctions, escapeRegExp, MIGRATIONS, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the timeline recorder migration (issue 666)
 * for the rules that are easy to break and expensive to find in production: the new column stays closed
 * to the publishable key, the writer is the earlier one plus the recorder and still answers the call the
 * deployed Edge Function makes, and the switch-in fill is the earlier one plus the recorder preference.
 */
const RECORDER = '20261108200000_hero_timeline_recorder.sql';
const TIMELINES = '20261108180000_match_hero_timelines.sql';
const SWITCH_INS = '20261108190000_hero_switch_in_aggregates.sql';
const HERO_FORMS = '20261108220000_hero_switch_in_hero_forms.sql';

const sql = withoutComments(read(RECORDER));
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyOf = (text: string, name: string): string => {
  const start = text.search(new RegExp(`create (or replace )?function public\\.${name}\\(`));
  assert.notEqual(start, -1, name);
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};
const latestDefiner = (name: string): string =>
  readdirSync(MIGRATIONS)
    .filter(file => file.endsWith('.sql') && withoutComments(read(file)).includes(`function public.${name}(`))
    .sort()
    .at(-1)!;

describe('the timeline recorder migration', () => {
  it('adds one nullable column to the timelines and nothing else to any table', () => {
    const alters = [...sql.matchAll(/\balter table ([\w.]+) ([^;]*);/gi)].map(match => `${match[1]} ${squash(match[2])}`);

    assert.deepEqual(alters, ['public.match_hero_timelines add column if not exists recorded_by text']);
    assert.doesNotMatch(sql, /\bcreate table\b/i);
    assert.doesNotMatch(sql, /\bdrop (table|column)\b/i);
  });

  it('leaves row level security and grants alone: the column is never granted to anyone', () => {
    assert.doesNotMatch(sql, /create policy|enable row level security|disable row level security/i);
    assert.doesNotMatch(sql, /(grant|revoke) [^;]* on (table )?public\.match_hero_timelines\b/i);
    assert.doesNotMatch(sql, /grant execute [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
    assert.match(read(TIMELINES), /revoke all on public\.match_hero_timelines from anon, authenticated/);
  });

  it('revokes execute from everyone and grants it to the service role for every function it states', () => {
    const functions = createdFunctions(sql);

    assert.deepEqual(functions, ['public.fill_hero_switch_in_aggregates(numeric)']);
    for (const signature of [...functions, 'public.record_match_hero_timelines(text, timestamptz, jsonb, text)']) {
      const escaped = escapeRegExp(signature);
      assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`), signature);
      assert.match(sql, new RegExp(`grant execute on function ${escaped} to service_role;`), signature);
    }
  });

  it('does not touch the purge, so every freeze is still called first', () => {
    assert.doesNotMatch(sql, /purge_expired_participants/);
    assert.equal(latestDefiner('purge_expired_participants'), SWITCH_INS);
  });

  it('is the latest definition of the writer, and of the fill until the hero forms migration (issue 667) restates it', () => {
    assert.equal(latestDefiner('record_match_hero_timelines'), RECORDER);
    assert.equal(latestDefiner('fill_hero_switch_in_aggregates'), HERO_FORMS);
  });
});

describe('record_match_hero_timelines after the migration', () => {
  const writer = bodyOf(sql, 'record_match_hero_timelines');
  const earlier = bodyOf(withoutComments(read(TIMELINES)), 'record_match_hero_timelines');

  it('replaces the three argument function in this migration, so PostgREST never sees two overloads', () => {
    assert.match(sql, /drop function if exists public\.record_match_hero_timelines\(text, timestamptz, jsonb\);/);
    assert.ok(sql.indexOf('drop function') < sql.indexOf('create function public.record_match_hero_timelines('));
    assert.doesNotMatch(sql, /create or replace function public\.record_match_hero_timelines/);
  });

  it('takes the recorder as a fourth argument that defaults to null, so the deployed three argument call still resolves', () => {
    assert.match(writer, /p_hero_timelines jsonb,\s+p_recorded_by text default null\s+\) returns integer/);
  });

  it('is the earlier writer with only the recorder added', () => {
    const rewritten = squash(writer)
      .replace('create function', 'create or replace function')
      .replace(', p_recorded_by text default null', '')
      .replace('at_second, recorded_by)', 'at_second)')
      .replace('o.at_second, p_recorded_by', 'o.at_second');

    assert.equal(rewritten, squash(earlier));
  });

  it('stores the recorder on every row it writes, and writes no row in a match that already has timelines', () => {
    assert.match(writer, /\(fingerprint, half_season, played_at, team, timeline_no, pick_no, hero_id, at_second, recorded_by\)/);
    assert.match(writer, /o\.hero_id, o\.at_second, p_recorded_by\s+from ordered o/);
    assert.match(writer, /if exists \(\s*select 1 from public\.match_hero_timelines t\s+where t\.fingerprint = p_fingerprint and t\.played_at = match_played_at\s*\) then\s+return 0;/);
  });
});

describe('fill_hero_switch_in_aggregates after the migration', () => {
  const fill = bodyOf(sql, 'fill_hero_switch_in_aggregates');
  const earlier = bodyOf(withoutComments(read(SWITCH_INS)), 'fill_hero_switch_in_aggregates');

  it('is the earlier fill with only the recorder preference changed', () => {
    const rewritten = squash(fill)
      .replace(/with timeline_recorders as materialized \(.*?\), match_rows as materialized \(/, 'with match_rows as materialized (')
      .replace('coalesce(min(r.recorder), min(p.recorded_by)) as recorder', 'min(p.recorded_by) as recorder')
      .replace(' left join timeline_recorders r on r.fingerprint = p.fingerprint and r.played_at = p.played_at', '');

    assert.equal(rewritten, squash(earlier));
  });

  it('reads the recorder from the timelines of the same half-season and match, one value per match', () => {
    assert.match(fill, /select k\.fingerprint, k\.played_at, min\(k\.recorded_by\) as recorder\s+from public\.match_hero_timelines k\s+where k\.half_season = p_half_season\s+group by k\.fingerprint, k\.played_at/);
    assert.match(fill, /left join timeline_recorders r on r\.fingerprint = p\.fingerprint and r\.played_at = p\.played_at/);
  });

  it('prefers the timeline uploader and falls back to the scoreboard recorder, per match', () => {
    assert.match(fill, /coalesce\(min\(r\.recorder\), min\(p\.recorded_by\)\) as recorder/);
    assert.deepEqual([...fill.matchAll(/left join (\w+)/g)].map(match => match[1]), ['timeline_recorders']);
  });

  it('keeps the recorder out of every stored count table: only numbers are written', () => {
    const insert = fill.slice(fill.indexOf('insert into public.hero_switch_ins'));

    assert.doesNotMatch(insert, /\brecorder\b(?!s)/);
  });
});

describe('the Edge Function after the migration', () => {
  const index = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

  it('sends the verified recorder hash with the timelines', () => {
    assert.match(index, /rpc\('record_match_hero_timelines', \{[^}]*p_recorded_by: match\.recordedBy,[^}]*\}\)/);
    assert.match(index, /recordHeroTimelines\(supabase, \{ fingerprint, playedAt, extended, recordedBy \}\)/);
  });

  it('sends the same hash the scoreboard is stored under', () => {
    assert.match(index, /const recordedBy = await recorderId\(username, requiredEnvironmentValue\('RECORDER_ID_SECRET'\)\);/);
    assert.match(index, /rpc\('record_match_participants', \{[^}]*p_recorded_by: recordedBy,/);
  });
});
