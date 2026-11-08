import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createdFunctions, escapeRegExp, read, withoutComments } from './migration-sql.ts';

/**
 * Reads the migration that lets the line-up reader return a thin shape's team count. The reader's
 * gate, signature and grants must stay as 20261107140000 made them; only what it withholds changes.
 */
const EARLIER = '20261107140000_team_lineup_shapes.sql';
const THIN_COUNTS = '20261108140000_team_lineup_thin_shape_counts.sql';
const READER = 'public.read_team_lineup_shapes(smallint[])';

const sql = withoutComments(read(THIN_COUNTS));
const earlier = withoutComments(read(EARLIER));
const body = (text: string): string => {
  const start = text.indexOf('create or replace function public.read_team_lineup_shapes(');
  return text.slice(start, text.indexOf('$$;', text.indexOf('as $$', start)));
};
const squash = (text: string): string => text.replace(/\s+/g, ' ');

describe('the thin line-up shape counts migration', () => {
  const reader = body(sql);

  it('restates only the reader, with the grants it had', () => {
    assert.deepEqual(createdFunctions(sql), [READER]);
    assert.match(sql, new RegExp(`revoke execute on function ${escapeRegExp(READER)} from public, anon, authenticated`));
    assert.match(sql, new RegExp(`grant execute on function ${escapeRegExp(READER)} to anon, service_role;`));
    assert.doesNotMatch(sql, /create table|alter table|\bdrop\b|cron\.schedule/i);
  });

  it('keeps the signature and the recorder gate exactly as they were', () => {
    const before = body(earlier);
    const upToSelect = (text: string): string => squash(text.slice(0, text.lastIndexOf('select d.half_season')));

    assert.equal(upToSelect(reader), upToSelect(before));
    assert.match(reader, /language sql\s+stable\s+security definer\s+set search_path = ''/);
  });

  it('returns the team count of a shape under the minimum and keeps its wins and its flag withheld', () => {
    assert.match(reader, /u\.teams::integer,\s+case when u\.teams >= public\.team_lineup_min_teams\(\) then u\.wins::integer end,/);
    assert.match(reader, /coalesce\(u\.teams >= public\.team_lineup_min_teams\(\), false\)/);
    assert.doesNotMatch(reader, /case when u\.teams >= public\.team_lineup_min_teams\(\) then u\.teams/);
  });

  it('asserts what comes back for a thin shape and that a hidden bucket stays hidden', () => {
    assert.match(sql, /assert not one_recorder_returned/);
    assert.match(sql, /assert thin_enough = false,/);
    assert.match(sql, /assert thin_teams = min_teams - 1,/);
    assert.match(sql, /assert thin_wins is null,/);
    assert.match(sql, /assert both_modes_classified = 2 \* min_teams \+ 49/);
    assert.match(sql, /raise exception 'roll back the lineup fixtures' using errcode = 'P0042'/);
  });

  it('lets only the fixture inserts be skipped: an error from the reader itself fails the push', () => {
    const handlers = [...sql.matchAll(/exception when others then\s+raise warning 'team lineup thin shape check skipped/g)];

    assert.equal(handlers.length, 1);
    assert.ok(handlers[0].index < sql.indexOf('read_team_lineup_shapes(array[0]::smallint[])'));
  });
});
