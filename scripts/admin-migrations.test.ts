import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { escapeRegExp, MIGRATIONS, read, withoutComments } from '../supabase/functions/track-match-history/migration-sql.ts';

/**
 * ADR-0005's database rules, checked against the SQL because this repo's tests cannot run a database
 * and CI starts none. They apply to every migration that creates the admin table or calls
 * `public.is_admin()`, so an admin table or function added later is held to them without editing this
 * file. `supabase/checks/admins.sql` proves the same rules against the linked project.
 */
const ADMIN_MIGRATION = '20261104140000_admins.sql';
const IS_ADMIN = 'public.is_admin()';

interface Declaration {
  name: string;
  /** Argument types as `revoke` and `grant` name them. */
  signature: string;
  body: string;
}

const adminMigrations = (): { name: string; sql: string }[] =>
  readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: withoutComments(read(name)) }))
    .filter(({ sql }) => /create table (?:if not exists )?public\.admins\b/.test(sql) || sql.includes(IS_ADMIN));

const tablesOf = (sql: string): string[] =>
  [...sql.matchAll(/create table (?:if not exists )?(public\.\w+)/g)].map((match) => match[1]);

function functionsOf(sql: string): Declaration[] {
  const found = sql.matchAll(
    /create (?:or replace )?function (public\.\w+)\(([^)]*)\)([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\4\$/g,
  );

  return [...found].map((match) => ({
    name: match[1],
    signature: `${match[1]}(${match[2]
      .split(',')
      .map((argument) => argument.trim().split(/\s+/).slice(-1)[0])
      .filter(Boolean)
      .join(', ')})`,
    body: match[5],
  }));
}

describe('the admin migrations', () => {
  const migrations = adminMigrations();

  it('include the one that adds the admin table', () => {
    assert.ok(migrations.some(({ name }) => name === ADMIN_MIGRATION));
  });

  for (const { name, sql } of migrations) {
    describe(name, () => {
      const code = sql.toLowerCase();

      for (const table of tablesOf(sql)) {
        it(`${table} has row-level security on, no policy and no grant to the API roles`, () => {
          const escaped = escapeRegExp(table);

          assert.match(code, new RegExp(`alter table ${escaped} enable row level security`));
          assert.match(code, new RegExp(`revoke all on ${escaped} from anon, authenticated`));
          assert.doesNotMatch(code, new RegExp(`create policy[^;]*\\bon ${escaped}\\b`));
          assert.doesNotMatch(code, new RegExp(`grant [^;]*\\bon (?:table )?${escaped}\\b`));
        });
      }

      for (const { name: functionName, signature, body } of functionsOf(sql)) {
        const escaped = escapeRegExp(signature);

        it(`${signature} runs as its owner with an empty search path`, () => {
          assert.match(code, new RegExp(`${escapeRegExp(functionName)}\\([^)]*\\)\\s+returns[\\s\\S]*?security definer\\s+set search_path = ''`));
        });

        it(`${signature} cannot be run by public or anon, and is granted to authenticated at most`, () => {
          assert.match(code, new RegExp(`revoke execute on function ${escaped} from public, anon`));
          assert.doesNotMatch(code, new RegExp(`grant execute on function ${escaped} to [^;]*\\b(anon|public)\\b`));
        });

        if (`${functionName}()` !== IS_ADMIN) {
          it(`${signature} asks is_admin() before it touches anything`, () => {
            assert.match(body, /public\.is_admin\(\)/);
            assert.ok(
              body.indexOf('public.is_admin()') < firstDataAccess(body),
              'is_admin() must be called before the first table is read or written',
            );
          });
        }
      }
    });
  }

  it('give the admin function a body that reads only the admin table, for the caller alone', () => {
    const isAdmin = functionsOf(withoutComments(read(ADMIN_MIGRATION))).find(({ name }) => `${name}()` === IS_ADMIN);

    assert.ok(isAdmin);
    assert.match(isAdmin.body, /from public\.admins\b/);
    assert.match(isAdmin.body, /\(select auth\.uid\(\)\)/);
    assert.doesNotMatch(isAdmin.body, /\b(insert|update|delete)\b/i);
  });

  it('write no row into the admin table', () => {
    for (const { sql } of migrations) {
      assert.doesNotMatch(sql, /\binsert\s+into\s+public\.admins\b/i);
    }
  });
});

/** The position of the first statement that reads or writes a table, or the end of the body. */
function firstDataAccess(body: string): number {
  const access = body.search(/\b(from|into|update|join)\s+public\./i);

  return access < 0 ? body.length : access;
}
