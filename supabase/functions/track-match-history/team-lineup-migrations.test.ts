import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { columnsOf, createdFunctions, createdTables, escapeRegExp, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the team line-up migration for the rules
 * that are easy to break and expensive to find in production: the posture of the new table, the
 * anonymity of the counts, the shape of the reader, and that restating the trio family's fill and
 * rebuild leaves the trios and totals exactly as they were. `supabase/checks/team_lineup_shapes.sql`
 * proves the counting against the linked project.
 */
const TRIOS = '20261107120000_triple_support_trios.sql';
const SHAPES = '20261107140000_team_lineup_shapes.sql';
const READER = 'public.read_team_lineup_shapes(smallint[])';

const sql = withoutComments(read(SHAPES));
const body = (text: string, signature: string): string => {
  const start = text.indexOf(`create or replace function ${signature}(`);
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};

describe('the team line-up migration', () => {
  it('turns row level security on for its table and leaves it with no policy', () => {
    assert.deepEqual(createdTables(sql), ['public.team_lineup_shapes']);
    assert.match(sql, /alter table public\.team_lineup_shapes enable row level security/);
    assert.match(sql, /revoke all on public\.team_lineup_shapes from anon, authenticated/);
    assert.match(sql, /grant [a-z, ]+ on public\.team_lineup_shapes to service_role/);
    assert.doesNotMatch(sql, /create policy/i);
    assert.doesNotMatch(sql, /grant [^;]* on (table )?public\.team_lineup\w* to [^;]*\b(anon|authenticated|public)\b/i);
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

  it('keeps the table free of who played and which hero: counts of roles only', () => {
    const columns = columnsOf(sql, 'public.team_lineup_shapes');

    assert.deepEqual(columns, [
      'half_season', 'play_mode_id', 'rank_bucket', 'vanguards', 'duelists', 'strategists', 'teams', 'wins',
    ]);
    for (const column of columns) {
      assert.doesNotMatch(column, /uid|name|fingerprint|recorded_by|participant|player|hero/, column);
    }
    assert.match(sql, /primary key \(half_season, play_mode_id, rank_bucket, vanguards, duelists, strategists\)/);
  });

  it('adds no second family: no new rebuild, freeze, cron job or purge, and nothing is dropped', () => {
    assert.deepEqual(
      createdFunctions(sql).sort(),
      [
        'public.fill_triple_support_aggregates(numeric)',
        'public.read_team_lineup_shapes(smallint[])',
        'public.rebuild_triple_support_aggregates(numeric, boolean)',
        'public.team_lineup_min_teams()',
      ],
    );
    assert.doesNotMatch(sql, /function public\.purge_expired_participants|cron\.schedule|\bdrop (table|column|function)\b/i);
  });

  it('names the same minimum as the website', () => {
    const database = sql.match(/team_lineup_min_teams\(\) returns integer[\s\S]*?select (\d+) \$\$/)?.[1];
    const website = readFileSync(new URL('../../../src/server/heroes/lineups/team-lineups.ts', import.meta.url), 'utf8')
      .match(/TEAM_LINEUP_MIN_TEAMS = (\d+);/)?.[1];

    assert.ok(database);
    assert.equal(database, website);
  });

  describe('fill_triple_support_aggregates', () => {
    const fill = body(sql, 'public.fill_triple_support_aggregates');
    const earlier = body(withoutComments(read(TRIOS)), 'public.fill_triple_support_aggregates');
    const fromTrios = (text: string): string => text.slice(text.indexOf('  trios as ('));

    it('writes the trios and totals exactly as the trio migration did, so the trio family does not change', () => {
      const writes = fromTrios(earlier);
      const shapes = fill.slice(fill.indexOf('  shapes as ('), fill.indexOf('  team_counts as ('));
      const withoutShapes = fromTrios(fill).replace(shapes, '');

      assert.equal(withoutShapes.replace(/\s+/g, ' '), writes.replace(/\s+/g, ' '));
    });

    it('counts the roles of a team, from the same lookup and the same unresolved rule as the trios', () => {
      assert.match(fill, /left join public\.hero_game_roles r on r\.game_id = p\.hero_id/);
      assert.match(fill, /count\(\*\) filter \(where l\.role = 'Vanguard'\) as vanguards/);
      assert.match(fill, /count\(\*\) filter \(where l\.role = 'Duelist'\) as duelists/);
      assert.match(fill, /count\(\*\) filter \(where l\.role = 'Strategist'\) as strategists/);
      assert.match(fill, /bool_or\(l\.role is null\) as unresolved/);
    });

    it('stores a shape only for a resolved team with a result, one occurrence per team', () => {
      const shapes = fill.slice(fill.indexOf('  shapes as ('), fill.indexOf('  team_counts as ('));

      assert.match(shapes, /where t\.is_win is not null and not t\.unresolved/);
      assert.match(shapes, /group by t\.play_mode_id, t\.rank_bucket, t\.vanguards, t\.duelists, t\.strategists/);
      assert.match(shapes, /count\(\*\), count\(\*\) filter \(where t\.is_win\)/);
    });

    it('counts a match once, whoever recorded it', () => {
      assert.match(fill, /dense_rank\(\) over \(order by p\.fingerprint, p\.played_at\)/);
    });
  });

  it('empties the shapes with the trios and totals when a half-season is rebuilt', () => {
    const rebuild = body(sql, 'public.rebuild_triple_support_aggregates');
    const earlier = body(withoutComments(read(TRIOS)), 'public.rebuild_triple_support_aggregates');

    assert.match(rebuild, /delete from public\.team_lineup_shapes where half_season = p_half_season/);
    assert.equal(
      rebuild.replace(/\s+delete from public\.team_lineup_shapes where half_season = p_half_season;/, '').replace(/\s+/g, ' '),
      earlier.replace(/\s+/g, ' '),
    );
  });

  describe('read_team_lineup_shapes', () => {
    const reader = body(sql, 'public.read_team_lineup_shapes');

    it('takes the modes asked for (Competitive by default) and returns the shape, its counts and the half-season team counts, with no recorder column', () => {
      assert.match(reader, /p_play_mode_ids smallint\[\] default array\[1\]::smallint\[\]/);
      const returned = reader.match(/returns table \(([\s\S]*?)\)\s*language/)?.[1] ?? '';
      assert.deepEqual(
        returned.split(',').map(column => column.trim().split(/\s+/)[0]),
        ['half_season', 'rank_bucket', 'vanguards', 'duelists', 'strategists', 'teams', 'wins', 'enough_data', 'classified_teams', 'unclassified_teams'],
      );
    });

    it('runs as its owner and shows a rank bucket only when the recorder gate passes, for the shapes and the team counts alike', () => {
      assert.match(reader, /security definer/);
      assert.match(reader, /t\.rank_bucket < 0\s+or public\.community_bucket_shown\(t\.matches, t\.recorders, t\.top_recorder_matches\)/);
      assert.match(reader, /join shown s\s+on s\.half_season = x\.half_season and s\.play_mode_id = x\.play_mode_id and s\.rank_bucket = x\.rank_bucket/);
      assert.match(reader, /t\.play_mode_id = any \(p_play_mode_ids\)/);
      assert.doesNotMatch(reader, /(max|sum)\(t\.(recorders|top_recorder_matches)/);
    });

    it('withholds the counts of a shape under the minimum, applied to the sum over the modes', () => {
      assert.match(reader, /case when u\.teams >= public\.team_lineup_min_teams\(\) then u\.teams::integer end/);
      assert.match(reader, /case when u\.teams >= public\.team_lineup_min_teams\(\) then u\.wins::integer end/);
      assert.match(reader, /coalesce\(u\.teams >= public\.team_lineup_min_teams\(\), false\)/);
    });

    it('keeps a half-season with only unclassified teams, as a row with no shape', () => {
      assert.match(reader, /from denominators d\s+left join summed u on u\.half_season = d\.half_season and u\.rank_bucket = d\.rank_bucket/);
    });

    it('keeps its order, so a caller can page through the rows', () => {
      assert.match(reader, /order by d\.half_season, d\.rank_bucket, u\.vanguards, u\.duelists, u\.strategists/);
    });
  });

  it('checks the gate and the minimum when it runs, and rolls the fixtures back', () => {
    assert.match(sql, /assert not one_recorder_returned/);
    assert.match(sql, /assert thin_enough = false and thin_teams is null/);
    assert.match(sql, /assert both_modes_classified = 449/);
    assert.match(sql, /raise exception 'roll back the lineup fixtures' using errcode = 'P0042'/);
    assert.match(sql, /exception when sqlstate 'P0042' then\s+null;/);
  });

  it('lets only the fixture inserts be skipped: an error from the reader itself fails the push', () => {
    const handlers = [...sql.matchAll(/exception when others then\s+raise warning 'team lineup gate check skipped/g)];
    assert.equal(handlers.length, 1);
    assert.ok(handlers[0].index < sql.indexOf('read_team_lineup_shapes(array[0]::smallint[])'));
  });
});
