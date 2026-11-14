import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createdFunctions, createdTables, escapeRegExp, read, withoutComments } from './migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the specialist migrations (issues 819 and 826) for
 * the rules that are easy to break and expensive to find in production: nothing is stored, only pooled counts
 * leave the reader, it is the service role's alone, and the website prints the same numbers it applies. The
 * rules are in the first migration; the reader in force is the one the second migration restates.
 */
const MIGRATION = '20261111120000_hero_specialists.sql';
const SPEED_MIGRATION = '20261111190000_hero_specialists_speed.sql';
const READER = 'public.read_hero_specialists()';
const RULES = [
  'hero_specialist_min_share_percent',
  'hero_specialist_min_hero_matches',
  'hero_flex_max_top_share_percent',
  'hero_flex_min_heroes',
  'hero_flex_min_matches',
  'hero_specialist_min_players',
  'hero_specialist_min_recorders',
  'hero_specialist_min_bucket_matches',
];

const sql = withoutComments(read(MIGRATION));
const speedSql = withoutComments(read(SPEED_MIGRATION));
const readerStart = speedSql.indexOf(`create or replace function ${READER}`);
const reader = speedSql.slice(readerStart, speedSql.indexOf('$$;', speedSql.indexOf('as $$', readerStart)));
const ruleValue = (name: string): string | undefined =>
  sql.match(new RegExp(`function public\\.${name}\\(\\) returns integer[\\s\\S]*?as \\$\\$ select (\\d+) \\$\\$`))?.[1];

describe('the hero specialists migration', () => {
  it('stores nothing: it only creates functions', () => {
    assert.deepEqual(createdTables(sql), []);
    assert.doesNotMatch(sql, /create table|alter table|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|cron\.schedule/i);
    assert.deepEqual(createdFunctions(sql), [...RULES.map((name) => `public.${name}()`), READER]);
  });

  it('restates only the reader, storing nothing (issue 826)', () => {
    assert.deepEqual(createdTables(speedSql), []);
    assert.doesNotMatch(speedSql, /create table|alter table|\binsert\b|\bupdate\b|\bdelete\b|\bdrop\b|cron\.schedule/i);
    assert.deepEqual(createdFunctions(speedSql), [READER]);
  });

  it('keeps the reader fast: one read of participants, and no step joined back onto the lines', () => {
    assert.equal(reader.match(/public\.participants/g)?.length, 1);
    assert.doesNotMatch(reader, /materialized/);
    assert.doesNotMatch(reader, /join (classified|people|person_hero|lines)\b/);
  });

  it('is a stable security definer reader with an empty search path, for the service role alone', () => {
    assert.match(reader, /returns jsonb\s+language sql\s+stable\s+security definer\s+set search_path = ''/);
    for (const migration of [sql, speedSql]) {
      assert.match(migration, new RegExp(`revoke execute on function ${escapeRegExp(READER)} from public, anon, authenticated;`));
      assert.match(migration, new RegExp(`grant execute on function ${escapeRegExp(READER)} to service_role;`));
      assert.doesNotMatch(migration, /grant execute[^;]*\bto\b[^;]*\b(anon|authenticated|public)\b/);
    }

    for (const name of RULES) {
      assert.match(sql, new RegExp(`revoke execute on function public\\.${name}\\(\\) from public, anon, authenticated;`));
    }
  });

  it('returns pooled counts only: no uid, name, fingerprint, recorder or number of people', () => {
    const output = reader.slice(reader.lastIndexOf('select coalesce(jsonb_agg('));

    assert.deepEqual(
      [...output.matchAll(/'(\w+)',/g)].map((match) => match[1]),
      ['half_season', 'hero_id', 'specialist_matches', 'specialist_wins', 'flex_matches', 'flex_wins'],
    );
    assert.doesNotMatch(output, /\b(uid|name|fingerprint|recorder|recorders|people)\b/);
  });

  it('leaves lines with no uid, no result, no hero and modes other than Quick Match and Competitive out', () => {
    assert.match(reader, /where btrim\(p\.uid\) <> ''\s+and p\.is_win is not null\s+and p\.hero_id > 0\s+and p\.play_mode_id in \(0, 1\)/);
  });

  it('merges a hero the game splits by role through hero_game_roles', () => {
    assert.match(reader, /coalesce\(r\.base_game_id, p\.hero_id\) as hero_id/);
    assert.match(reader, /left join public\.hero_game_roles r on r\.game_id = p\.hero_id/);
  });

  it('shows a hero only when both buckets pass all three gates', () => {
    assert.match(reader, /b\.people >= public\.hero_specialist_min_players\(\)\s+and pr\.recorders >= public\.hero_specialist_min_recorders\(\)\s+and b\.matches >= public\.hero_specialist_min_bucket_matches\(\)/);
    assert.match(reader, /from shown s\s+join shown f on f\.half_season = s\.half_season and f\.hero_id = s\.hero_id and f\.bucket = 'flex'\s+where s\.bucket = 'specialist'/);
  });

  it('prints the same numbers the website applies and publishes', () => {
    const website = readFileSync(new URL('../../../src/server/heroes/specialists/hero-specialists.ts', import.meta.url), 'utf8');
    const constant = (name: string): string | undefined => website.match(new RegExp(`${name} = (\\d+)`))?.[1];

    assert.equal(constant('SPECIALIST_MIN_SHARE_PERCENT'), ruleValue('hero_specialist_min_share_percent'));
    assert.equal(constant('SPECIALIST_MIN_HERO_MATCHES'), ruleValue('hero_specialist_min_hero_matches'));
    assert.equal(constant('FLEX_MAX_TOP_SHARE_PERCENT'), ruleValue('hero_flex_max_top_share_percent'));
    assert.equal(constant('FLEX_MIN_HEROES'), ruleValue('hero_flex_min_heroes'));
    assert.equal(constant('FLEX_MIN_MATCHES'), ruleValue('hero_flex_min_matches'));
    assert.equal(constant('HERO_SPECIALISTS_MIN_PLAYERS'), ruleValue('hero_specialist_min_players'));
    assert.equal(constant('HERO_SPECIALISTS_MIN_RECORDERS'), ruleValue('hero_specialist_min_recorders'));
    assert.equal(constant('HERO_SPECIALISTS_MIN_MATCHES'), ruleValue('hero_specialist_min_bucket_matches'));
  });

  it('has a fixture check that proves the rules and rolls back', () => {
    const check = readFileSync(new URL('../../checks/hero_specialists.sql', import.meta.url), 'utf8');

    assert.match(check, /^begin;$/m);
    assert.match(check, /^rollback;$/m);
    assert.doesNotMatch(check, /^commit;$/m);
    assert.match(check, /Deadpool/);
    assert.match(check, /uid/);
  });
});
