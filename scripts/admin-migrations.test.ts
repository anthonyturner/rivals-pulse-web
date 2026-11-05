import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { MIGRATIONS, read } from '../supabase/functions/track-match-history/migration-sql.ts';
import { ADMIN_MIGRATION, GUARDED_FROM, adminRuleViolations, type Migration } from './admin-migration-rules.ts';

/**
 * ADR-0005's database rules, checked against the SQL because this repo's tests cannot run a database
 * and CI starts none. `adminRuleViolations` reads every migration, not only the ones that mention
 * admin: from `GUARDED_FROM` on, any function a signed-in account can call must guard itself with
 * `public.is_admin()` or be listed as deliberately not admin-only, so a forgotten guard is caught in
 * the migration that forgot it. `supabase/checks/admins.sql` proves the same rules against the linked
 * project.
 */
const allMigrations = (): Migration[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: read(name) }));

const AFTER = `${GUARDED_FROM.slice(0, 8)}150000_next.sql`;
const BEFORE = '20260101000000_old.sql';

/** Runs the rules on the real admin migration plus one made-up migration. */
const violationsOf = (name: string, sql: string): string[] =>
  adminRuleViolations([...allMigrations().filter((migration) => migration.name === ADMIN_MIGRATION), { name, sql }]);

describe('the real migrations', () => {
  it('include the one that adds the admin table', () => {
    assert.ok(allMigrations().some(({ name }) => name === ADMIN_MIGRATION));
  });

  it('keep every ADR-0005 rule', () => {
    assert.deepEqual(adminRuleViolations(allMigrations()), []);
  });

  it('write no row into the admin table', () => {
    for (const { name, sql } of allMigrations()) {
      assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /\binsert\s+into\s+public\.admins\b/i, name);
    }
  });

  it('close the admin table to the service role as well, so the website\'s service key cannot touch it', () => {
    assert.match(read(ADMIN_MIGRATION), /revoke all on public\.admins from anon, authenticated, service_role;/);
  });

  it('give is_admin() a body that reads only the admin table, for the caller alone', () => {
    const sql = read(ADMIN_MIGRATION).replace(/--.*$/gm, '');
    const body = sql.match(/function public\.is_admin\(\)[\s\S]*?\$\$([\s\S]*?)\$\$/)?.[1] ?? '';

    assert.match(body, /from public\.admins\b/);
    assert.match(body, /\(select auth\.uid\(\)\)/);
    assert.doesNotMatch(body, /\b(insert|update|delete)\b/i);
  });
});

describe('the rules catch', () => {
  const guarded = `
    create or replace function public.admin_read() returns jsonb language plpgsql security definer set search_path = '' as $fn$
    begin
      if not public.is_admin() then raise exception 'no' using errcode = '42501'; end if;
      return (select to_jsonb(t) from public.settings t);
    end $fn$;
    revoke execute on function public.admin_read() from public, anon;
    grant execute on function public.admin_read() to authenticated;
  `;

  it('accepts a function that guards itself first (so the cases below fail for their own reason)', () => {
    assert.deepEqual(violationsOf(AFTER, guarded), []);
  });

  it('a new function granted to authenticated that never calls is_admin()', () => {
    const sql = `
      create or replace function public.read_settings() returns jsonb language sql security definer set search_path = '' as $$
        select to_jsonb(t) from public.settings t
      $$;
      revoke execute on function public.read_settings() from public, anon;
      grant execute on function public.read_settings() to authenticated;
    `;

    assert.match(violationsOf(AFTER, sql).join('\n'), /read_settings is callable by signed-in accounts/);
  });

  it('a new function that revokes nothing, because Supabase grants it to authenticated by default', () => {
    const sql = `create or replace function public.read_settings() returns jsonb language sql as $$ select to_jsonb(t) from public.settings t $$;`;

    assert.match(violationsOf(AFTER, sql).join('\n'), /read_settings is callable by signed-in accounts/);
  });

  it('a function that calls is_admin() only after it has read a table', () => {
    const sql = guarded.replace(
      /if not public\.is_admin\(\)[^;]*; end if;\s*return \(select to_jsonb\(t\) from public\.settings t\);/,
      `perform 1 from public.settings; if not public.is_admin() then raise exception 'no'; end if; return null;`,
    );

    assert.match(violationsOf(AFTER, sql).join('\n'), /admin_read is callable/);
  });

  it('an admin-named function with no guard, even one only the service role can run', () => {
    const sql = `
      create or replace function public.admin_rebuild() returns void language sql security definer set search_path = '' as $$
        select 1 from public.settings
      $$;
      revoke execute on function public.admin_rebuild() from public, anon, authenticated;
    `;

    assert.match(violationsOf(BEFORE, sql).join('\n'), /admin_rebuild is callable/);
  });

  it('an admin function that does not run as its owner or leaves anon able to call it', () => {
    const sql = `
      create or replace function public.admin_read() returns jsonb language plpgsql as $fn$
      begin
        perform public.is_admin();
        return null;
      end $fn$;
      grant execute on function public.admin_read() to anon, authenticated;
    `;
    const found = violationsOf(AFTER, sql).join('\n');

    assert.match(found, /admin_read must run as its owner/);
    assert.match(found, /admin_read must revoke execute from public and anon/);
    assert.match(found, /admin_read must not be granted to anon or public/);
  });

  it('a later grant on the admin table', () => {
    assert.match(violationsOf(AFTER, 'grant select on public.admins to authenticated;').join('\n'), /public\.admins must keep its posture/);
  });

  it('a later policy on the admin table', () => {
    const sql = 'create policy "Admins read" on public.admins for select to authenticated using (true);';

    assert.match(violationsOf(AFTER, sql).join('\n'), /public\.admins must keep its posture/);
  });

  it('a later change that turns row-level security off on the admin table', () => {
    const sql = 'alter table public.admins disable row level security;';

    assert.match(violationsOf(BEFORE, sql).join('\n'), /public\.admins must keep its posture/);
  });

  it('a later migration that makes someone an administrator', () => {
    const sql = "insert into public.admins (user_id) values ('00000000-0000-0000-0000-000000000000');";

    assert.match(violationsOf(AFTER, sql).join('\n'), /must not make anyone an administrator/);
  });

  it('a new table with admin in its name that has no row-level security', () => {
    const sql = `
      create table if not exists public.admin_settings (id int primary key);
      grant select on public.admin_settings to authenticated;
    `;
    const found = violationsOf(BEFORE, sql).join('\n');

    assert.match(found, /admin_settings must enable row-level security/);
    assert.match(found, /admin_settings must revoke all from anon and authenticated/);
    assert.match(found, /admin_settings must not be granted to anyone/);
  });

  it('a table in a migration that guards with is_admin(), left open to authenticated', () => {
    const sql = `
      create table if not exists public.site_settings (id int primary key);
      alter table public.site_settings enable row level security;
      revoke all on public.site_settings from anon, authenticated;
      create policy "Anyone" on public.site_settings for select to authenticated using (true);
    `;

    assert.match(violationsOf(AFTER, `${sql}\n${guarded}`).join('\n'), /site_settings must have no policy/);
  });
});

describe('the rules leave alone', () => {
  it('a function only the service role can run', () => {
    const sql = `
      create or replace function public.rebuild_things() returns void language sql security definer set search_path = '' as $$
        select 1 from public.things
      $$;
      revoke execute on function public.rebuild_things() from public, anon, authenticated;
      grant execute on function public.rebuild_things() to service_role;
    `;

    assert.deepEqual(violationsOf(AFTER, sql), []);
  });

  it('a signed-in function from before the rule, such as the ones the account routes call', () => {
    const sql = `
      create or replace function public.read_mine() returns jsonb language sql security definer set search_path = '' as $$
        select to_jsonb(t) from public.mine t
      $$;
      grant execute on function public.read_mine() to authenticated;
    `;

    assert.deepEqual(violationsOf(BEFORE, sql), []);
  });

  it('a trigger function, which a client cannot call', () => {
    const sql = `create or replace function public.touch() returns trigger language plpgsql as $t$ begin return new; end $t$;`;

    assert.deepEqual(violationsOf(AFTER, sql), []);
  });

  it('a table and a function in a migration that has nothing to do with admins', () => {
    const sql = `
      create table if not exists public.things (id int primary key);
      create or replace function public.list_things() returns jsonb language sql stable as $$ select '[]'::jsonb $$;
      grant select on public.things to anon;
    `;

    assert.deepEqual(violationsOf(BEFORE, sql), []);
  });
});
