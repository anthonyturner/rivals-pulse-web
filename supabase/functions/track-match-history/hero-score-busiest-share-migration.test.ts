import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createdFunctions, createdTables, read, withoutComments } from './migration-sql.ts';

/**
 * Reads the migration that bases the hero scores' busiest-player flags on the published share. It must
 * be the previous reader with only those four comparisons changed, so what qualifies and what is
 * granted stay as they were.
 */
const SOLO = '20261106170000_solo_hero_build_signals.sql';
const SHARE = '20261108150000_hero_score_busiest_share.sql';
const READER = 'public.read_community_hero_scores()';

const sql = withoutComments(read(SHARE));
const solo = withoutComments(read(SOLO));
const squash = (text: string): string => text.replace(/\s+/g, ' ');
const readerOf = (text: string): string => {
  const start = text.indexOf('create or replace function public.read_community_hero_scores(');
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};

describe('the hero score busiest-player migration', () => {
  it('restates only the reader, with the grants it had and nothing else', () => {
    assert.deepEqual(createdFunctions(sql), [READER]);
    assert.deepEqual(createdTables(sql), []);
    assert.doesNotMatch(sql, /\b(alter|drop|delete|truncate|update|insert)\b/i);
    assert.match(sql, /revoke execute on function public\.read_community_hero_scores\(\) from public, anon, authenticated/);
    assert.match(sql, /grant execute on function public\.read_community_hero_scores\(\) to service_role/);
  });

  it('flags a busiest player only above the published limit, for every figure and every ability slot', () => {
    const reader = readerOf(sql);

    for (const figure of ['damage', 'healing', 'blocked']) {
      assert.match(
        reader,
        new RegExp(`'${figure}_busiest_above_half', a\\.${figure}_top_recorder_n \\* 100 > a\\.${figure}_n \\* public\\.community_max_recorder_share_percent\\(\\)`),
        figure,
      );
    }
    assert.match(
      reader,
      /'busiest_above_half', u\.top_recorder_segments \* 100 > u\.segments \* public\.community_max_recorder_share_percent\(\)/,
    );
    assert.doesNotMatch(reader, /\* 2 >/);
  });

  it('is the previous reader in every other way: same shape, same qualifying rule, same keys', () => {
    const changed = (text: string): string =>
      squash(readerOf(text))
        .replace(/ \* 2 > /g, ' > ')
        .replace(/ \* 100 > ([a-z_.]+) \* public\.community_max_recorder_share_percent\(\)/g, ' > $1');

    assert.equal(changed(sql), changed(solo));
  });

  it('checks the flag against the live limit when it runs', () => {
    assert.match(sql, /\(10 \* 100 > 10 \* share\) = \(share < 100\)/);
    assert.match(sql, /\(5 \* 100 > 10 \* share\) = \(share < 50\)/);
  });
});
