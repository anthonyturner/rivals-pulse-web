import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { columnsOf, createdFunctions, createdTables, escapeRegExp, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the triple-support migration for the rules
 * that are easy to break and expensive to find in production: the posture of every new object, the
 * anonymity of the counts, the shape of the reader, and the rules that make a team a trio.
 * `supabase/checks/triple_support_trios.sql` proves the counting against the linked project.
 * `hero-pair-migrations.test.ts` checks that the latest purge freezes this family too.
 */
const TRIOS = '20261107120000_triple_support_trios.sql';
const READER = 'public.read_triple_support_trios(smallint[])';

const sql = withoutComments(read(TRIOS));

describe('the triple-support migration', () => {
  it('turns row level security on for every table and leaves it with no policy', () => {
    assert.deepEqual(createdTables(sql).sort(), [
      'public.hero_game_roles',
      'public.triple_support_aggregate_half_seasons',
      'public.triple_support_totals',
      'public.triple_support_trios',
    ]);
    for (const table of createdTables(sql)) {
      assert.match(sql, new RegExp(`alter table ${table} enable row level security`), table);
      assert.match(sql, new RegExp(`revoke all on ${table} from anon, authenticated`), table);
      assert.match(sql, new RegExp(`grant [a-z, ]+ on ${table} to service_role`), table);
    }
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.(triple_support|hero_game_roles)\w* to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('revokes execute from everyone on every function, and grants only the reader to the publishable key', () => {
    const functions = createdFunctions(sql);
    assert.ok(functions.includes(READER));
    for (const signature of functions) {
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

  it('stores a trio as counts keyed by half-season, mode, rank bucket and the three heroes in order', () => {
    assert.deepEqual(columnsOf(sql, 'public.triple_support_trios'), [
      'half_season', 'play_mode_id', 'rank_bucket', 'hero_a', 'hero_b', 'hero_c', 'matches', 'teams', 'wins',
    ]);
    assert.match(sql, /primary key \(half_season, play_mode_id, rank_bucket, hero_a, hero_b, hero_c\)/);
    assert.match(sql, /hero_a <= hero_b and hero_b <= hero_c/);
    assert.match(sql, /rank_bucket >= -1/);
  });

  it('stores the recorder figures the gate needs, and the team counts, as numbers in the totals', () => {
    assert.deepEqual(columnsOf(sql, 'public.triple_support_totals'), [
      'half_season', 'play_mode_id', 'rank_bucket', 'matches', 'decided_matches', 'recorders', 'top_recorder_matches',
      'classified_teams', 'unclassified_teams', 'four_plus_teams',
    ]);
  });

  it('is its own family: it adds a fill, rebuild, recompute and freeze and touches no other family', () => {
    const functions = createdFunctions(sql);
    for (const name of ['fill', 'rebuild', 'recompute', 'freeze']) {
      assert.ok(functions.some(signature => signature.startsWith(`public.${name}_triple_support_aggregates(`)), name);
    }
    assert.doesNotMatch(sql, /function public\.(fill|rebuild|recompute)_(hero|hero_pair|extended)_aggregates/);
    assert.doesNotMatch(sql, /\bdrop (table|column|function)\b/i);
    assert.match(sql, /cron\.schedule\('recompute-triple-support-aggregates'/);
  });

  it('seeds the role of each hero, with no row for hero id 0 or Deadpool\'s role-less base id 1057', () => {
    const rows = [...sql.matchAll(/^\s*\((\d+), (\d+), '(Vanguard|Duelist|Strategist)'\)/gm)];
    const ids = rows.map(match => Number(match[1]));

    assert.ok(rows.length >= 50);
    assert.equal(new Set(ids).size, ids.length, 'a game id is seeded twice');
    assert.ok(!ids.includes(0) && !ids.includes(1057));
    assert.deepEqual(rows.filter(match => Number(match[1]) >= 10000).map(match => [match[1], match[2], match[3]]), [
      ['10571', '1057', 'Vanguard'],
      ['10572', '1057', 'Duelist'],
      ['10573', '1057', 'Strategist'],
    ]);
  });

  describe('fill_triple_support_aggregates', () => {
    const start = sql.indexOf('create or replace function public.fill_triple_support_aggregates(');
    const fill = sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));

    it('looks a hero up by game id, so a hero with no role (id 0, 1057, a new hero) leaves its team unresolved', () => {
      assert.match(fill, /left join public\.hero_game_roles r on r\.game_id = p\.hero_id/);
      assert.match(fill, /bool_or\(l\.role is null\) as unresolved/);
    });

    it('counts a trio only for a resolved team of exactly three Strategists with a result', () => {
      assert.match(fill, /where t\.is_win is not null and not t\.unresolved and t\.strategists = 3/);
    });

    it('keys a trio by the three base game ids in ascending order', () => {
      assert.match(fill, /array_agg\(l\.base_game_id order by l\.base_game_id\) filter \(where l\.role = 'Strategist'\)/);
    });

    it('counts a team with four or more Strategists as a shape only, and an unresolved team as unclassified', () => {
      assert.match(fill, /not t\.unresolved and t\.strategists >= 4\) as four_plus_teams/);
      assert.match(fill, /count\(\*\) filter \(where t\.unresolved\) as unclassified_teams/);
      assert.match(fill, /count\(\*\) filter \(where not t\.unresolved\) as classified_teams/);
    });

    it('counts a match once, whoever recorded it, and a team once in it', () => {
      assert.match(fill, /dense_rank\(\) over \(order by p\.fingerprint, p\.played_at\)/);
      assert.match(fill, /count\(distinct t\.match_no\) as matches/);
    });

    it('stores a trio only when its half-season total reaches the minimum', () => {
      assert.match(fill, /half_season_matches >= public\.triple_support_min_matches\(\)/);
    });
  });

  describe('read_triple_support_trios', () => {
    const start = sql.indexOf('create or replace function public.read_triple_support_trios(');
    const reader = sql.slice(start, sql.indexOf('$$;', sql.indexOf('as $$', start)));

    it('takes the modes asked for and returns the trio, its counts and the half-season team counts, with no recorder column', () => {
      assert.match(reader, /p_play_mode_ids smallint\[\]/);
      const returned = reader.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? '';
      assert.deepEqual(
        returned.split(',').map(column => column.trim().split(/\s+/)[0]),
        ['half_season', 'rank_bucket', 'hero_a', 'hero_b', 'hero_c', 'matches', 'teams', 'wins', 'classified_teams', 'unclassified_teams', 'four_plus_teams'],
      );
    });

    it('runs as its owner and shows a rank bucket only when the recorder gate passes, for the trios and the team counts alike', () => {
      assert.match(reader, /security definer/);
      assert.match(reader, /t\.rank_bucket < 0\s+or public\.community_bucket_shown\(t\.matches, t\.recorders, t\.top_recorder_matches\)/);
      assert.match(reader, /join shown s\s+on s\.half_season = x\.half_season and s\.play_mode_id = x\.play_mode_id and s\.rank_bucket = x\.rank_bucket/);
    });

    it('sums over the modes asked for after the gate, and applies the minimum again to the sum', () => {
      assert.match(reader, /t\.play_mode_id = any \(p_play_mode_ids\)/);
      assert.match(reader, /having sum\(x\.matches\) >= public\.triple_support_min_matches\(\)/);
      assert.doesNotMatch(reader, /(max|sum)\(t\.(recorders|top_recorder_matches)/);
    });

    it('keeps its order, so a caller can page through the rows', () => {
      assert.match(reader, /order by u\.half_season, u\.rank_bucket, u\.hero_a, u\.hero_b, u\.hero_c/);
    });
  });

  it('checks the gate when it runs: a hidden fixture must not come back, and the fixtures are rolled back', () => {
    assert.match(sql, /assert not one_recorder_returned/);
    assert.match(sql, /assert three_recorders_matches = 10/);
    assert.match(sql, /assert both_modes_matches = 10/);
    assert.match(sql, /assert both_modes_classified = 20/);
    assert.match(sql, /raise exception 'roll back the gate fixtures' using errcode = 'P0042'/);
    assert.match(sql, /exception when sqlstate 'P0042' then\s+null;/);
  });

  it('lets only the fixture inserts be skipped: an error from the reader itself fails the push', () => {
    const handlers = [...sql.matchAll(/exception when others then\s+raise warning 'triple support gate check skipped/g)];
    assert.equal(handlers.length, 1);
    assert.ok(handlers[0].index < sql.indexOf('read_triple_support_trios(array[0]::smallint[])'));
  });

  it('still deletes what the earlier purge deleted: scoreboard rows and the kill feed', () => {
    const body = sql.slice(sql.indexOf('create or replace function public.purge_expired_participants()'));
    assert.match(body, /delete from public\.participants p/);
    assert.match(body, /delete from public\.match_hero_kills k/);
    assert.match(body, /perform public\.freeze_triple_support_aggregates\(\);/);
  });
});
