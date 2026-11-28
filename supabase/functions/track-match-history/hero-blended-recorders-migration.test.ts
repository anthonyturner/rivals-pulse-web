import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createdFunctions, createdTables, read, withoutComments } from './migration-sql.ts';

/**
 * Reads the migration that counts the different players behind each hero across Quick Match and
 * Competitive together (issue 644). It must be the earlier fill and reader with only the blended
 * count added, so the per-mode counts, the rebuild, the freeze and the grants stay as they were.
 */
const BLENDED = '20261108170000_hero_blended_recorders.sql';
const PREVIOUS = '20261108160000_hero_aggregate_recorders.sql';

const sql = withoutComments(read(BLENDED));
const previous = withoutComments(read(PREVIOUS));
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyOf = (text: string, name: string): string => {
  const start = text.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, name);
  return squash(text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start))));
};

describe('the blended hero recorder count migration', () => {
  it('adds one nullable whole-number column and no table, so a frozen half-season reads as not counted', () => {
    assert.deepEqual(createdTables(sql), []);
    assert.match(sql, /alter table public\.hero_aggregates add column if not exists blended_recorders integer;/);
    assert.doesNotMatch(sql, /blended_recorders integer[^;]*not null/);
    assert.doesNotMatch(sql, /\b(drop|delete|truncate|update)\b/i);
  });

  it('keeps the blended count at one or more and at least the mode count, or null', () => {
    assert.match(
      sql,
      /check \(blended_recorders is null or \(blended_recorders >= 1 and blended_recorders >= coalesce\(recorders, 1\)\)\)/,
    );
    assert.match(sql, /conname = 'hero_aggregates_blended_recorders_consistent'/);
  });

  it('restates only the fill and the reader, with the grants they had', () => {
    assert.deepEqual(createdFunctions(sql), ['public.fill_hero_aggregates(numeric)', 'public.read_hero_stats()']);
    assert.match(sql, /revoke execute on function public\.fill_hero_aggregates\(numeric\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.fill_hero_aggregates\(numeric\) to service_role;/);
    assert.match(sql, /revoke execute on function public\.read_hero_stats\(\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.read_hero_stats\(\) to anon, service_role;/);
  });

  it('keeps the security and search path of the reader and the fill', () => {
    assert.match(bodyOf(sql, 'read_hero_stats'), /^create or replace function public\.read_hero_stats\(\) returns jsonb language sql stable security definer set search_path = '' as \$\$/);
    assert.match(bodyOf(sql, 'fill_hero_aggregates'), /^create or replace function public\.fill_hero_aggregates\(p_half_season numeric\) returns void language sql set search_path = '' as \$\$/);
  });

  it('counts the distinct recorder of each match per hero over Quick Match and Competitive, and changes nothing else in the fill', () => {
    const fill = bodyOf(sql, 'fill_hero_aggregates');

    assert.match(
      fill,
      /blended as \( select l\.hero_id, count\(distinct l\.recorder\)::integer as recorders from l where l\.hero_id is not null and l\.play_mode_id in \(0, 1\) group by l\.hero_id \),/,
    );
    assert.match(fill, /left join blended b on b\.hero_id = l\.hero_id and l\.play_mode_id in \(0, 1\) where l\.hero_id is not null group by l\.play_mode_id, l\.hero_id/);

    const withoutBlended = fill
      .replace(/ blended as \(.*?\),(?= heroes as)/, '')
      .replace('recorders, blended_recorders)', 'recorders)')
      .replace('count(distinct l.recorder)::integer, max(b.recorders) from l left join blended b on b.hero_id = l.hero_id and l.play_mode_id in (0, 1) where', 'count(distinct l.recorder)::integer from l where');

    assert.equal(withoutBlended, bodyOf(previous, 'fill_hero_aggregates'));
  });

  it('returns the stored blended count beside the others, and changes nothing else in the reader', () => {
    const reader = bodyOf(sql, 'read_hero_stats');

    assert.match(reader, /'recorders', a\.recorders, 'blended_recorders', a\.blended_recorders\)/);
    assert.equal(reader.replace(", 'blended_recorders', a.blended_recorders", ''), bodyOf(previous, 'read_hero_stats'));
  });

  it('returns a count and never an id, a name or a fingerprint', () => {
    assert.doesNotMatch(bodyOf(sql, 'read_hero_stats'), /\b(uid|name|fingerprint|recorded_by)\b/);
  });

  it('fills the half-seasons that are not frozen once the column exists, and leaves a frozen one null', () => {
    assert.match(sql, /select public\.recompute_hero_aggregates\(\);\s*$/);
    assert.ok(sql.indexOf('add column if not exists blended_recorders') < sql.indexOf('select public.recompute_hero_aggregates()'));
  });

  it('checks the count when it runs: once per person across modes, not outside the blend, and the reader returns it', () => {
    assert.match(sql, /assert hero_one_quick = 2 and hero_one_competitive = 2/);
    assert.match(sql, /assert hero_one_quick_own = 1 and hero_one_competitive_own = 1/);
    assert.match(sql, /assert hero_two_quick = 1 and hero_two_competitive = 1/);
    assert.match(sql, /assert hero_four_quick = 1/);
    assert.match(sql, /assert hero_four_arcade is null/);
    assert.match(sql, /assert hero_three_rows = 1 and hero_three_arcade is null/);
    assert.match(sql, /assert reader_hero_one = 2/);
    assert.match(sql, /assert reader_hero_three -> 'blended_recorders' = 'null'::jsonb/);
    assert.match(sql, /errcode = 'P0042'/);
  });
});
