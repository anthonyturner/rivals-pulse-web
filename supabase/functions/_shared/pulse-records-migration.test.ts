import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { read, withoutComments } from '../track-match-history/migration-sql.ts';

/**
 * The Pulse Records read cannot be run by this repo's tests (no database here);
 * `supabase/checks/pulse_records.sql` proves its rules against the linked project. These read the SQL
 * for the posture that is easy to break and expensive to find in production: who may call the
 * function, what it may return, and which guards sit in front of a line.
 */
const READ_MIGRATION = '20261107100100_pulse_records_read.sql';
const SETTINGS_MIGRATION = '20261107100000_account_settings.sql';

const sql = withoutComments(read(READ_MIGRATION));
const settingsSql = withoutComments(read(SETTINGS_MIGRATION));

const body = sql.match(/create or replace function public\.read_pulse_records\(\)[\s\S]*?\n\$\$;/)?.[0] ?? '';

/** Every key the function puts in its answer: the first argument of each jsonb_build_object pair. */
const answerKeys = [...body.matchAll(/'(\w+)',\s*(?:k\.|r\.|coalesce|\()/g)].map((match) => match[1]);

describe(READ_MIGRATION, () => {
  it('declares the read once, with no parameters', () => {
    assert.ok(body, 'the function body was not found');
    assert.deepEqual(
      [...sql.matchAll(/create or replace function (public\.\w+)\(([^)]*)\)/g)].map((match) => match[1]),
      ['public.pulse_records_value_cap', 'public.pulse_records_rate_cap', 'public.read_pulse_records'],
    );
    assert.match(body, /read_pulse_records\(\) returns jsonb/);
  });

  it('runs as definer with an empty search path, so nothing it names can be swapped', () => {
    assert.match(body, /security definer/);
    assert.match(body, /set search_path = ''/);
    assert.equal(body.match(/search_path/g)?.length, 1);
  });

  it('is executable by the service role alone', () => {
    const revoked = sql.match(/revoke execute on function public\.read_pulse_records\(\) from ([^;]*);/)?.[1] ?? '';

    assert.deepEqual(revoked.split(',').map((role) => role.trim()).sort(), ['anon', 'authenticated', 'public', 'service_role']);
    assert.deepEqual(
      [...sql.matchAll(/grant execute on function public\.read_pulse_records\(\) to (\w+)/g)].map((match) => match[1]),
      ['service_role'],
    );
    assert.doesNotMatch(sql, /grant [^;]* to [^;]*\b(anon|authenticated|public)\b/i);
  });

  it('keeps the ceiling helpers closed to every API role', () => {
    for (const helper of ['pulse_records_value_cap', 'pulse_records_rate_cap']) {
      const revoked = sql.match(new RegExp(`revoke execute on function public\\.${helper}\\(text\\) from ([^;]*);`))?.[1] ?? '';

      assert.deepEqual(revoked.split(',').map((role) => role.trim()).sort(), ['anon', 'authenticated', 'public', 'service_role'], helper);
      assert.doesNotMatch(sql, new RegExp(`grant execute on function public\\.${helper}`));
    }
  });

  it('returns only the allowed keys, and none that could name a line, a recorder, a player or a time', () => {
    assert.deepEqual([...new Set(answerKeys)].sort(), ['categories', 'coveredFrom', 'heroId', 'key', 'name', 'rows', 'value']);
    assert.deepEqual(
      answerKeys.filter((key) => /uid|recorder|recorded|^id$|line|participant|match|time|played/i.test(key)),
      [],
    );
  });

  it('shows the link\'s name, cleaned, and never the scoreboard line\'s', () => {
    const shown = body.match(/nullif\(btrim\(regexp_replace\(\s*own\.player_name,\s*'([^']*)'/)?.[1];

    assert.ok(shown, 'the cleaned link name was not found');
    // The class is written in the regex dialect both Postgres and JavaScript read, so JavaScript can judge it.
    const stripped = new RegExp(shown);
    const bidirectional = [0x61c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069];
    for (const codePoint of [...bidirectional, 0x200b, 0xfeff, 0x0a, 0x7f]) {
      assert.ok(stripped.test(String.fromCodePoint(codePoint)), `U+${codePoint.toString(16)} is not stripped`);
    }
    assert.ok(!stripped.test('Aurora Prime-9'), 'an ordinary name is altered');
    assert.match(body, /'name', r\.shown_name/);
    assert.doesNotMatch(body.replace(/lower\(btrim\(p\.name\)\)/g, ''), /\bp\.name\b/);
  });

  it('names a line only on the two-key match plus the setting, and leaves a claimed uid off otherwise', () => {
    assert.match(body, /left join public\.player_links own\s+on own\.recorder_id = p\.recorded_by and own\.player_uid = p\.uid/);
    assert.match(body, /left join public\.account_settings s on s\.user_id = own\.user_id/);
    assert.match(body, /own\.user_id is null or coalesce\(s\.show_in_records, false\)/);
    assert.match(body, /own\.user_id is not null\s+or not exists \(select 1 from public\.player_links claimed where claimed\.player_uid = p\.uid\)/);
  });

  it('counts Quick Match and Competitive only, and a real hero', () => {
    assert.match(body, /p\.play_mode_id in \(0, 1\)/);
    assert.match(body, /p\.hero_id > 0/);
  });

  it('leaves out hidden lines and do_not_store players', () => {
    assert.match(body, /not exists \(select 1 from public\.records_hidden h where h\.participant_id = p\.id\)/);
    assert.match(body, /d\.kind = 'uid' and d\.key = p\.uid/);
    assert.match(body, /d\.kind = 'name' and d\.key = lower\(btrim\(p\.name\)\)/);
  });

  it('holds a value to a ceiling, and a figure to time played and a per-minute ceiling', () => {
    assert.match(body, /c\.value between 1 and public\.pulse_records_value_cap\(c\.category\)/g);
    assert.match(body, /f\.seconds > 0/);
    assert.match(body, /c\.value \* 60\.0 \/ f\.seconds <= public\.pulse_records_rate_cap\(c\.category\)/);
    assert.match(body, /where l\.is_named/);
  });

  it('keeps one row per player, then one per uploader, the earlier match winning a tie, and 50 rows', () => {
    assert.match(body, /distinct on \(category, player_key\)[\s\S]*?order by category, player_key, value desc, played_at, id/);
    assert.match(body, /distinct on \(category, recorded_by\)[\s\S]*?order by category, recorded_by, value desc, played_at, id/);
    assert.match(body, /r\.place <= 50/);
    assert.match(body, /when own\.user_id is not null then 'account:'/);
  });

  it('only reads: it writes nothing and opens no table to a client', () => {
    assert.doesNotMatch(body, /\b(insert|update|delete)\b/i);
    assert.doesNotMatch(sql, /grant (select|insert|update|delete|all)/i);
  });

  it('sets its ceilings from the real data and below what the columns allow', () => {
    const values = ceilings('pulse_records_value_cap');
    const rates = ceilings('pulse_records_rate_cap');

    assert.deepEqual(Object.keys(values), ['kills', 'assists', 'final_hits', 'damage', 'healing', 'blocked']);
    assert.deepEqual(Object.keys(rates), ['damage', 'healing', 'blocked']);
    assert.ok(Object.values(values).every((cap) => cap > 0 && cap < 1_000_000), 'a ceiling is at or above what the column allows');
    for (const category of Object.keys(rates)) {
      assert.ok(values[category] <= rates[category] * 120, `${category}: the value ceiling is out of reach inside a 7,200 second segment at the per-minute ceiling`);
    }
  });

  it('creates the hide list closed to every API role, deleted with its line', () => {
    assert.match(sql, /participant_id bigint primary key references public\.participants \(id\) on delete cascade/);
    assert.match(sql, /alter table public\.records_hidden enable row level security/);
    assert.match(sql, /revoke all on public\.records_hidden from anon, authenticated, service_role/);
    assert.doesNotMatch(sql, /create policy/i);
  });
});

describe(SETTINGS_MIGRATION, () => {
  it('creates one table, off by default, deleted with its account', () => {
    assert.deepEqual([...settingsSql.matchAll(/create table if not exists (public\.\w+)/g)].map((match) => match[1]), ['public.account_settings']);
    assert.match(settingsSql, /user_id uuid primary key references auth\.users \(id\) on delete cascade/);
    assert.match(settingsSql, /show_in_records boolean not null default false/);
  });

  it('has row level security on, and lets a signed-in account read its own row and nothing more', () => {
    assert.match(settingsSql, /alter table public\.account_settings enable row level security/);
    assert.match(settingsSql, /revoke all on public\.account_settings from anon, authenticated, service_role/);
    assert.deepEqual(
      [...settingsSql.matchAll(/grant ([^;]*?) on public\.account_settings to ([^;]*);/g)].map((match) => [match[1], match[2]]),
      [['select', 'authenticated']],
    );
    assert.match(settingsSql, /for select to authenticated\s+using \(\(select auth\.uid\(\)\) = user_id\)/);
    assert.equal(settingsSql.match(/create policy/g)?.length, 1);
  });
});

/** The value each `when '<category>' then <n>` arm of a helper returns. */
function ceilings(helper: string): Record<string, number> {
  const text = sql.match(new RegExp(`function public\\.${helper}\\(p_category text\\)[\\s\\S]*?\\n\\$\\$;`))?.[0] ?? '';

  return Object.fromEntries([...text.matchAll(/when '(\w+)' then (\d+)/g)].map((match) => [match[1], Number(match[2])]));
}
