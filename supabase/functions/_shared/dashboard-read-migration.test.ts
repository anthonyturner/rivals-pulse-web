import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The dashboard read cannot be run by this repo's tests (no database here); `supabase/checks/
 * dashboard.sql` proves its rules against the linked project. These read the SQL for the posture
 * that is easy to break and expensive to find in production: who may call the function, whose lines
 * it may return, and that it opens nothing else.
 */
const sql = readFileSync(new URL('../../migrations/20261101040000_dashboard_read.sql', import.meta.url), 'utf8')
  .replace(/--.*$/gm, '');

const body = sql.match(/create or replace function public\.read_own_dashboard\(\)[\s\S]*?\n\$\$;/)?.[0] ?? '';

describe('20261101040000_dashboard_read.sql', () => {
  it('declares the one function, once, with no parameters', () => {
    assert.deepEqual([...sql.matchAll(/create (?:or replace )?function (public\.\w+)\(([^)]*)\)/g)].map(match => [match[1], match[2]]), [
      ['public.read_own_dashboard', ''],
    ]);
    assert.ok(body, 'the function body was not found');
  });

  it('runs as definer with an empty search path, so nothing it names can be swapped', () => {
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.equal(sql.match(/search_path/g)?.length, 1);
  });

  it('is granted to signed-in accounts only', () => {
    assert.match(sql, /revoke execute on function public\.read_own_dashboard\(\) from public, anon, authenticated/);
    assert.deepEqual([...sql.matchAll(/grant execute on function public\.read_own_dashboard\(\) to (\w+)/g)].map(match => match[1]), ['authenticated']);
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
    const where = body.match(/from public\.participants p\s+where([\s\S]*?)order by/)?.[1] ?? '';
    assert.match(where, /p\.recorded_by = own_link\.recorder_id/);
    assert.match(where, /\band p\.uid = own_link\.player_uid/);
    assert.doesNotMatch(where, /\bor\b/);
  });

  it('reads figures only for the lines it returned', () => {
    assert.match(body, /from public\.participant_hero_figures f\s+where f\.participant_id = l\.id/);
  });

  it('caps the lines it returns', () => {
    assert.match(body, /line_cap constant integer := \d+/);
    assert.match(body, /limit line_cap \+ 1/);
    assert.match(body, /filter \(where l\.rn <= line_cap\)/);
  });

  it('only reads: it writes nothing and opens no table to a client', () => {
    assert.doesNotMatch(body, /\b(insert|update|delete)\b/i);
    assert.doesNotMatch(sql, /create table|alter table|create policy|grant (select|insert|update|delete|all)/i);
  });

  it('never names the recorder or the uid in what it returns', () => {
    const keys = [...body.matchAll(/'(\w+)',/g)].map(match => match[1]);
    assert.ok(keys.includes('lines') && keys.includes('playedAt'), 'the answer keys were not found');
    assert.deepEqual(keys.filter(key => /recorder|recorded|uid/i.test(key)), []);
  });
});
