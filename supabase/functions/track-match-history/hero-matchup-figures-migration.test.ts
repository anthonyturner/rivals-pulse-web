import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MIGRATIONS, createdFunctions, createdTables, read, withoutComments } from './migration-sql.ts';

/**
 * Reads the migration that gives each matchup the kills, deaths, assists and final hits of its
 * decided lines (issue 651). It must be the latest fill with only the matchups insert changed, and the
 * earlier matchup reader with only the figures added, so the other counts, the rebuild, the freeze and
 * the grants stay as they were.
 */
const FIGURES = '20261108210000_hero_matchup_encounter_figures.sql';
const PREVIOUS_FILL = '20261108170000_hero_blended_recorders.sql';
const PREVIOUS_READER = '20261030050000_hero_stats_read.sql';

const sql = withoutComments(read(FIGURES));
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyOf = (text: string, name: string): string => {
  const start = text.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, name);
  return squash(text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start))));
};
const COLUMNS = ['kills', 'deaths', 'assists', 'final_hits'].flatMap(figure => [`${figure}_sum`, `${figure}_n`]);

describe('the hero matchup encounter figures migration', () => {
  it('builds on the newest body of the fill that came before it', () => {
    const between = readdirSync(MIGRATIONS)
      .filter(name => name.endsWith('.sql') && name > PREVIOUS_FILL && name < FIGURES)
      .filter(name => /create or replace function public\.fill_hero_aggregates\(/.test(withoutComments(read(name))));

    assert.deepEqual(between, []);
  });

  it('adds nullable whole-number columns and no table, so a frozen half-season reads as not counted', () => {
    assert.deepEqual(createdTables(sql), []);
    for (const column of COLUMNS) {
      assert.match(sql, new RegExp(`add column if not exists ${column} integer(,|;)`), column);
    }
    assert.doesNotMatch(sql, /add column [^,;]*(not null|default)/);
    assert.doesNotMatch(sql, /\b(drop|delete|truncate)\b/i);
  });

  it('keeps each figure count at or under the decided lines it is counted over, or null', () => {
    assert.match(sql, /conname = 'hero_matchups_figure_counts_consistent'/);
    for (const figure of ['kills', 'deaths', 'assists', 'final_hits']) {
      assert.match(sql, new RegExp(`\\(${figure}_n is null or ${figure}_n <= decided_lines\\)`), figure);
    }
  });

  it('restates only the fill and the matchup reader, with the grants they had', () => {
    assert.deepEqual(createdFunctions(sql), [
      'public.fill_hero_aggregates(numeric)',
      'public.read_hero_matchups(smallint[])',
    ]);
    assert.match(sql, /revoke execute on function public\.fill_hero_aggregates\(numeric\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.fill_hero_aggregates\(numeric\) to service_role;/);
    assert.match(sql, /revoke execute on function public\.read_hero_matchups\(smallint\[\]\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.read_hero_matchups\(smallint\[\]\) to anon, service_role;/);
  });

  it('keeps the security and search path of the reader and the fill', () => {
    assert.match(bodyOf(sql, 'read_hero_matchups'), /security definer set search_path = '' as \$\$/);
    assert.match(bodyOf(sql, 'read_hero_matchups'), / stable /);
    assert.match(bodyOf(sql, 'fill_hero_aggregates'), /^create or replace function public\.fill_hero_aggregates\(p_half_season numeric\) returns void language sql set search_path = '' as \$\$/);
  });

  it('carries the figures through the distinct once per enemy hero faced, and changes nothing else in the fill', () => {
    const fill = bodyOf(sql, 'fill_hero_aggregates');

    assert.match(
      fill,
      /select distinct a\.line_id, a\.match_no, a\.play_mode_id, a\.hero_id, b\.hero_id as enemy_hero_id, a\.is_win, a\.kills, a\.deaths, a\.assists, a\.final_hits from l a join l b on b\.match_no = a\.match_no and b\.team <> a\.team/,
    );

    for (const figure of ['kills', 'deaths', 'assists', 'final_hits']) {
      assert.match(
        fill,
        new RegExp(`coalesce\\(sum\\(e\\.${figure}\\) filter \\(where e\\.is_win is not null\\), 0\\) as ${figure}_sum, count\\(e\\.${figure}\\) filter \\(where e\\.is_win is not null\\) as ${figure}_n`),
        figure,
      );
    }

    const withoutFigures = fill
      .replace(', kills_sum, kills_n, deaths_sum, deaths_n, assists_sum, assists_n, final_hits_sum, final_hits_n) select p_half_season, m.play_mode_id', ') select p_half_season, m.play_mode_id')
      .replace(', m.kills_sum, m.kills_n, m.deaths_sum, m.deaths_n, m.assists_sum, m.assists_n, m.final_hits_sum, m.final_hits_n from (', ' from (')
      .replace(/ coalesce\(sum\(e\.kills\).*? as final_hits_n,/, '')
      .replace(', a.kills, a.deaths, a.assists, a.final_hits from l a', ' from l a');

    assert.equal(withoutFigures, bodyOf(withoutComments(read(PREVIOUS_FILL)), 'fill_hero_aggregates'));
  });

  it('returns the summed figures beside the other counts, and changes nothing else in the reader', () => {
    const reader = bodyOf(sql, 'read_hero_matchups');

    for (const column of COLUMNS) {
      assert.match(reader, new RegExp(`'${column}', m\\.${column}`), column);
      assert.match(reader, new RegExp(`sum\\(x\\.${column}\\) as ${column}`), column);
    }

    const withoutFigures = reader
      .replace(/, 'kills_sum', m\.kills_sum.*?'final_hits_n', m\.final_hits_n\)/, ')')
      .replace(/, sum\(x\.kills_sum\).*?sum\(x\.final_hits_n\) as final_hits_n from/, ' from');

    assert.equal(withoutFigures, bodyOf(withoutComments(read(PREVIOUS_READER)), 'read_hero_matchups'));
  });

  it('returns counts and never an id, a name or a fingerprint', () => {
    assert.doesNotMatch(bodyOf(sql, 'read_hero_matchups'), /\b(uid|name|fingerprint|recorded_by)\b/);
  });

  it('fills the half-seasons that are not frozen once the columns exist, and leaves a frozen one null', () => {
    assert.match(sql, /select public\.recompute_hero_aggregates\(\);\s*$/);
    assert.ok(sql.indexOf('add column if not exists final_hits_n') < sql.indexOf('select public.recompute_hero_aggregates()'));
  });

  it('checks the figures when it runs: once per line, summed over modes, a missing one left out of its count, and null when frozen', () => {
    assert.match(sql, /assert one_against_two\.decided_lines = 6 and one_against_two\.kills_sum = 30/);
    assert.match(sql, /assert two_against_one\.decided_lines = 12/);
    assert.match(sql, /two_against_one\.assists_sum = 0 and two_against_one\.assists_n = 12/);
    assert.match(sql, /final_hits_sum'\)::integer = 90 and \(reader_one_against_two ->> 'final_hits_n'\)::integer = 9/);
    assert.match(sql, /assert reader_frozen -> 'kills_sum' = 'null'::jsonb/);
    assert.match(sql, /errcode = 'P0042'/);
  });
});
