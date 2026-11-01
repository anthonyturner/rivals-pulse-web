import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { columnsOf, createdFunctions, createdTables, escapeRegExp, MIGRATIONS, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the hero pair migration for the rules that
 * are easy to break and expensive to find in production: the posture of every new object, the
 * anonymity of the counts, the shape of the reader, and that the purge still freezes every family.
 */
const PAIRS = '20261101070000_hero_pair_aggregates.sql';
const READER = 'public.read_hero_pairs(smallint[])';

const sql = withoutComments(read(PAIRS));
const migrations = () => readdirSync(MIGRATIONS)
  .filter(name => name.endsWith('.sql'))
  .sort()
  .map(name => ({ name, sql: withoutComments(read(name)) }));

describe('the hero pair migration', () => {
  it('turns row level security on for both tables and leaves it with no policy', () => {
    assert.deepEqual(createdTables(sql).sort(), [
      'public.hero_pair_aggregate_half_seasons',
      'public.hero_pair_aggregates',
      'public.hero_pair_totals',
    ]);
    for (const table of createdTables(sql)) {
      assert.match(sql, new RegExp(`alter table ${table} enable row level security`), table);
      assert.match(sql, new RegExp(`revoke all on ${table} from anon, authenticated`), table);
      assert.match(sql, new RegExp(`grant [a-z, ]+ on ${table} to service_role`), table);
    }
    assert.doesNotMatch(sql, /create policy/i);
  });

  it('grants no table to anon, authenticated or public', () => {
    assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.hero_pair_\w+ to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('revokes execute from everyone on every function, and grants only the reader to the publishable key', () => {
    for (const signature of createdFunctions(sql)) {
      const escaped = escapeRegExp(signature);
      assert.match(sql, new RegExp(`revoke execute on function ${escaped} from public, anon, authenticated`), signature);
      const grantee = signature === READER ? 'anon, service_role' : 'service_role';
      assert.match(sql, new RegExp(`grant execute on function ${escaped} to ${grantee};`), signature);
    }
    assert.doesNotMatch(sql, /grant execute [^;]* to [^;]*\b(authenticated|public)\b/i);
  });

  it('keeps every table free of who played: no uid, name, fingerprint, recorder or participant column', () => {
    for (const table of createdTables(sql)) {
      const columns = columnsOf(sql, table);
      assert.ok(columns.length > 0, `no columns read for ${table}`);
      for (const column of columns) {
        assert.doesNotMatch(column, /uid|name|fingerprint|recorded_by|participant|player/, `${table}.${column}`);
      }
    }
  });

  it('stores a pair as counts keyed by half-season, mode, rank bucket, kind and the two heroes', () => {
    assert.deepEqual(columnsOf(sql, 'public.hero_pair_aggregates'), [
      'half_season', 'play_mode_id', 'rank_bucket', 'kind', 'hero_id', 'other_hero_id',
      'matches', 'decided_matches', 'decided_lines', 'wins',
    ]);
    assert.match(sql, /primary key \(half_season, play_mode_id, rank_bucket, kind, hero_id, other_hero_id\)/);
    assert.match(sql, /kind in \('vs', 'with'\)/);
    assert.match(sql, /kind <> 'with' or hero_id < other_hero_id/);
    assert.match(sql, /rank_bucket >= -1/);
  });

  it('stores the recorder figures the gate needs, as counts, in the totals', () => {
    assert.deepEqual(columnsOf(sql, 'public.hero_pair_totals'), [
      'half_season', 'play_mode_id', 'rank_bucket', 'matches', 'decided_matches', 'recorders', 'top_recorder_matches',
    ]);
  });

  it('is its own family: it adds a fill, rebuild, recompute and freeze and does not restate the hero aggregates', () => {
    const functions = createdFunctions(sql);
    for (const name of ['fill', 'rebuild', 'recompute', 'freeze']) {
      assert.ok(functions.some(signature => signature.startsWith(`public.${name}_hero_pair_aggregates(`)), name);
    }
    assert.doesNotMatch(sql, /function public\.(fill|rebuild|recompute)_hero_aggregates/);
    assert.doesNotMatch(sql, /\bdrop (table|column|function)\b/i);
    assert.match(sql, /cron\.schedule\('recompute-hero-pair-aggregates'/);
  });

  it('counts a "with" pair once per team occurrence and never pairs a hero with itself on a team', () => {
    assert.match(sql, /b\.team = a\.team and a\.hero_id < b\.hero_id/);
    assert.match(sql, /select distinct a\.match_no, a\.team,/);
  });

  it('stores a pair only when its half-season total reaches the minimum', () => {
    assert.match(sql, /half_season_decided_matches >= public\.hero_pair_min_matches\(\)/);
  });

  describe('read_hero_pairs', () => {
    const start = sql.indexOf('create or replace function public.read_hero_pairs(');
    const reader = sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));

    it('takes the modes asked for and returns the pair figures, with no recorder column', () => {
      assert.ok(createdFunctions(sql).includes(READER));
      assert.match(reader, /p_play_mode_ids smallint\[\]/);
      const returned = reader.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? '';
      assert.deepEqual(
        returned.split(',').map(column => column.trim().split(/\s+/)[0]),
        ['half_season', 'rank_bucket', 'kind', 'hero_id', 'other_hero_id', 'decided_matches', 'decided_lines', 'wins'],
      );
    });

    it('runs as its owner and shows a rank bucket only when the recorder gate passes', () => {
      assert.match(reader, /security definer/);
      assert.match(reader, /public\.community_bucket_shown\(/);
      assert.match(reader, /x\.rank_bucket < 0\s+or exists/);
    });

    it('sums over the modes asked for and applies the minimum again to the sum', () => {
      assert.match(reader, /x\.play_mode_id = any \(p_play_mode_ids\)/);
      assert.match(reader, /having sum\(x\.decided_matches\) >= public\.hero_pair_min_matches\(\)/);
    });

    it('gates each bucket of each mode on its own totals before summing, never on a combined figure', () => {
      assert.match(reader, /t\.half_season = x\.half_season\s+and t\.play_mode_id = x\.play_mode_id\s+and t\.rank_bucket = x\.rank_bucket\s+and public\.community_bucket_shown\(t\.matches, t\.recorders, t\.top_recorder_matches\)/);
      assert.doesNotMatch(reader, /(max|sum)\(t\./);
      assert.doesNotMatch(reader, /with shown/);
    });

    it('keeps its order, so a caller can page through the rows', () => {
      assert.match(reader, /order by x\.half_season, x\.rank_bucket, x\.kind, x\.hero_id, x\.other_hero_id/);
    });
  });

  it('checks the gate when it runs: a hidden fixture must not come back, and the fixtures are rolled back', () => {
    assert.match(sql, /assert not one_recorder_returned/);
    assert.match(sql, /assert three_recorders_matches = 10/);
    assert.match(sql, /assert both_modes_matches = 10/);
    assert.match(sql, /raise exception 'roll back the gate fixtures' using errcode = 'P0042'/);
    assert.match(sql, /exception when sqlstate 'P0042' then\s+null;/);
  });

  it('lets only the fixture inserts be skipped: an error from the reader itself fails the push', () => {
    const handlers = [...sql.matchAll(/exception when others then\s+raise warning 'hero pair gate check skipped/g)];
    assert.equal(handlers.length, 1);
    assert.ok(handlers[0].index < sql.indexOf('read_hero_pairs(array[0]::smallint[])'));
  });

  it('leaves the latest purge freezing every family, this one included, before it deletes anything', () => {
    const everyFreeze = [
      ...new Set(migrations().flatMap(({ sql: text }) => [...text.matchAll(/create or replace function (public\.freeze_\w+)\(/g)].map(match => `${match[1]}(`))),
      'public.rebuild_hero_aggregates(',
    ];
    assert.ok(everyFreeze.includes('public.freeze_hero_pair_aggregates('));
    assert.ok(everyFreeze.includes('public.freeze_extended_aggregates('));

    const latest = migrations().filter(({ sql: text }) => /create or replace function public\.purge_expired_participants\(\)/.test(text)).at(-1);
    assert.ok(latest, 'no migration defines the purge');

    const body = latest.sql.slice(latest.sql.indexOf('create or replace function public.purge_expired_participants()'));
    const firstDelete = body.indexOf('delete from');
    for (const freeze of everyFreeze) {
      const at = body.indexOf(freeze);
      assert.ok(at >= 0, `the purge no longer calls ${freeze}`);
      assert.ok(at < firstDelete, `${freeze} must run before the first delete`);
    }
  });

  it('still deletes what the earlier purge deleted: scoreboard rows and the kill feed', () => {
    const body = sql.slice(sql.indexOf('create or replace function public.purge_expired_participants()'));
    assert.match(body, /delete from public\.participants p/);
    assert.match(body, /delete from public\.match_hero_kills k/);
  });
});
