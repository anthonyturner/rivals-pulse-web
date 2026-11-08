import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MIGRATIONS, createdFunctions, createdTables, read, withoutComments } from './migration-sql.ts';

/**
 * Reads the migration that counts the different players behind each hero (issue 628). It must be the
 * earlier fill and reader with only the count added, so the other counts, the rebuild, the freeze and
 * the grants stay as they were.
 */
const RECORDERS = '20261108160000_hero_aggregate_recorders.sql';
const BASE = '20261030000000_hero_aggregates.sql';
const READ = '20261030050000_hero_stats_read.sql';
const PURGE = '20261107120000_triple_support_trios.sql';

const sql = withoutComments(read(RECORDERS));
const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();
const bodyOf = (text: string, name: string): string => {
  const start = text.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, name);
  return squash(text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start))));
};

describe('the hero recorder count migration', () => {
  it('adds one nullable whole-number column and no table, so a frozen half-season reads as not counted', () => {
    assert.deepEqual(createdTables(sql), []);
    assert.match(sql, /alter table public\.hero_aggregates add column if not exists recorders integer;/);
    assert.doesNotMatch(sql, /recorders integer[^;]*not null/);
    assert.doesNotMatch(sql, /\b(drop|delete|truncate|update)\b/i);
  });

  it('keeps the count between one and the matches, or null', () => {
    assert.match(sql, /check \(recorders is null or \(recorders >= 1 and recorders <= matches\)\)/);
    assert.match(sql, /conname = 'hero_aggregates_recorders_consistent'/);
  });

  it('restates only the fill and the reader, with the grants they had', () => {
    assert.deepEqual(createdFunctions(sql), ['public.fill_hero_aggregates(numeric)', 'public.read_hero_stats()']);
    assert.match(sql, /revoke execute on function public\.fill_hero_aggregates\(numeric\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.fill_hero_aggregates\(numeric\) to service_role;/);
    assert.match(sql, /revoke execute on function public\.read_hero_stats\(\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.read_hero_stats\(\) to anon, service_role;/);
  });

  it('counts the distinct recorder of each match per hero and mode, and changes nothing else in the fill', () => {
    const fill = bodyOf(sql, 'fill_hero_aggregates');

    assert.match(fill, /min\(p\.recorded_by\) over \(partition by p\.fingerprint, p\.played_at\) as recorder,/);
    assert.match(fill, /count\(distinct l\.recorder\)::integer from l where l\.hero_id is not null group by l\.play_mode_id, l\.hero_id/);

    const withoutCount = fill
      .replace('min(p.recorded_by) over (partition by p.fingerprint, p.played_at) as recorder, ', '')
      .replace('final_hits_n, recorders)', 'final_hits_n)')
      .replace(', count(distinct l.recorder)::integer', '');

    assert.equal(withoutCount, bodyOf(withoutComments(read(BASE)), 'fill_hero_aggregates'));
  });

  it('returns the stored count beside the other figures, and changes nothing else in the reader', () => {
    const reader = bodyOf(sql, 'read_hero_stats');

    assert.match(reader, /'final_hits_n', a\.final_hits_n, 'recorders', a\.recorders\)/);
    assert.deepEqual(
      reader.replace(", 'recorders', a.recorders", ''),
      bodyOf(withoutComments(read(READ)), 'read_hero_stats'),
    );
  });

  it('returns a count and never an id, a name or a fingerprint', () => {
    const reader = bodyOf(sql, 'read_hero_stats');

    assert.doesNotMatch(reader, /\b(uid|name|fingerprint|recorded_by)\b/);
  });

  it('reaches the rebuild and the freeze through the fill, which they already call', () => {
    const base = withoutComments(read(BASE));
    const purge = withoutComments(read(PURGE));

    assert.match(bodyOf(base, 'rebuild_hero_aggregates'), /perform public\.fill_hero_aggregates\(p_half_season\)/);
    assert.match(bodyOf(purge, 'purge_expired_participants'), /perform public\.rebuild_hero_aggregates\(due\.half_season, true\)/);
    assert.deepEqual(
      readdirSync(MIGRATIONS)
        .filter((name) => name > RECORDERS && withoutComments(read(name)).includes('function public.purge_expired_participants(')),
      [],
      'a later migration that restates the purge must keep the freeze that calls the fill',
    );
  });

  it('fills the half-seasons that are not frozen once the column exists', () => {
    assert.match(sql, /select public\.recompute_hero_aggregates\(\);\s*$/);
    assert.ok(sql.indexOf('add column if not exists recorders') < sql.indexOf('select public.recompute_hero_aggregates()'));
  });

  it('checks the count when it runs: once per recorder, per hero and mode, and the reader returns it', () => {
    assert.match(sql, /assert hero_one_mode_zero = 2/);
    assert.match(sql, /assert hero_two_mode_zero = 1/);
    assert.match(sql, /assert hero_one_mode_one = 1 and hero_one_matches = 1/);
    assert.match(sql, /assert reader_recorders = 2/);
    assert.match(sql, /errcode = 'P0042'/);
  });
});
