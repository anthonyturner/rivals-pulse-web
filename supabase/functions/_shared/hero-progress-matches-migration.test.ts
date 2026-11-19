import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createdFunctions, createdTables, read, withoutComments } from '../track-match-history/migration-sql.ts';

/**
 * There is no database in this repo's tests, so these read the SQL for the posture that is easy to break and
 * expensive to find in production (issue 863): who may call the function, whose lines it may return, that it
 * stores nothing, and that no recorder, uid, name or roster leaves in its answer.
 */
const sql = withoutComments(read('20261114100000_hero_progress_matches.sql'));
const READER = 'public.read_own_hero_progress_matches()';
const body = sql.match(/create or replace function public\.read_own_hero_progress_matches\(\)[\s\S]*?\n\$\$;/)?.[0] ?? '';

describe('20261114100000_hero_progress_matches.sql', () => {
  it('declares the one reader, once, with no parameters', () => {
    assert.deepEqual(createdFunctions(sql), [READER]);
    assert.ok(body, 'the function body was not found');
  });

  it('only reads: it stores nothing, writes nothing and opens no table to a client', () => {
    assert.deepEqual(createdTables(sql), []);
    assert.doesNotMatch(body, /\b(insert|update|delete)\b/i);
    assert.doesNotMatch(sql, /create table|alter table|create policy|cron\.schedule|grant (select|insert|update|delete|all)/i);
  });

  it('is a stable security definer reader with an empty search path', () => {
    assert.match(body, /returns jsonb\s+language plpgsql\s+stable\s+security definer\s+set search_path = ''/);
    assert.equal(sql.match(/search_path/g)?.length, 1);
  });

  it('is granted to signed-in accounts only, because the account is whoever the session says it is', () => {
    const revoked = sql.match(/revoke execute on function public\.read_own_hero_progress_matches\(\) from ([^;]*);/)?.[1] ?? '';
    assert.deepEqual(revoked.split(',').map(role => role.trim()).sort(), ['anon', 'authenticated', 'public', 'service_role']);
    assert.deepEqual([...sql.matchAll(/grant execute on function public\.read_own_hero_progress_matches\(\) to (\w+)/g)].map(match => match[1]), ['authenticated']);
    assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|public|service_role)\b/i);
  });

  it('refuses a caller with no account and an anonymous session', () => {
    assert.match(body, /account uuid := \(select auth\.uid\(\)\)/);
    assert.match(body, /if account is null then\s+raise exception[^;]*errcode = '28000'/);
    assert.match(body, /auth\.jwt\(\)\) ->> 'is_anonymous'[^;]*= 'true'\s+then\s+raise exception[^;]*errcode = '42501'/);
  });

  it('takes the player from the caller\'s own link, and from nothing the caller passes', () => {
    assert.match(body, /from public\.player_links where user_id = account/);
    assert.doesNotMatch(body, /\bp_\w+/);
  });

  it('returns only lines the link can prove are its own: its recorder AND its uid', () => {
    const where = body.match(/from public\.participants l\s+where([\s\S]*?);/)?.[1] ?? '';
    assert.match(where, /l\.recorded_by = own_link\.recorder_id/);
    assert.match(where, /\band l\.uid = own_link\.player_uid/);
    assert.doesNotMatch(where, /\bor\b/);
  });

  it('has no row cap, since a cut-off history would lower a level, and reads figures only for the lines it returned', () => {
    assert.doesNotMatch(body, /\blimit\b/i);
    assert.match(body, /from public\.participant_hero_figures f\s+where f\.participant_id = l\.id/);
  });

  it('returns the facts the rules read, and never the recorder, the uid, the name, the roster or the fingerprint', () => {
    const keys = [...body.slice(body.indexOf('select coalesce(jsonb_agg(')).matchAll(/'(\w+)',/g)].map(match => match[1]);
    assert.deepEqual(keys, [
      'matchKey', 'playedAt', 'halfSeason', 'playModeId', 'isWin', 'heroId', 'figures',
      'heroId', 'seconds', 'damage', 'healing', 'blocked', 'linked', 'matches',
    ]);
    assert.match(body, /'matchKey', l\.id::text/);
    assert.doesNotMatch(body, /fingerprint/);
  });
});
