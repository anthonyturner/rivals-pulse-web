export interface Migration {
  name: string;
  sql: string;
}

/**
 * ADR-0005's database rules as a function over migrations, so the test can run it on the real
 * migrations (it must find nothing) and on deliberately bad SQL (it must find each fault).
 */

/** The migration that creates `public.admins` and `public.is_admin()`. */
export const ADMIN_MIGRATION = '20261104140000_admins.sql';

/** From this version on, a function a signed-in account can call must guard itself or be listed. */
export const GUARDED_FROM = '20261104140000';

/**
 * Functions granted to `authenticated` from `GUARDED_FROM` on that are deliberately not admin-only,
 * as `public.name`. Adding one is a decision for review: it is callable by anyone who signs up.
 */
export const NOT_ADMIN_FUNCTIONS: readonly string[] = [
  // The "Show me in Pulse Records" switch (issue 568): any linked player changes their own setting. It names no account and touches only the caller's row.
  'public.set_records_opt_in',
  // The media defaults (issue 705): any signed-in account sets its own hero video and sound defaults. It names no account and touches only the caller's row.
  'public.set_media_defaults',
];

const IS_ADMIN = 'public.is_admin';

interface FunctionDeclaration {
  name: string;
  returnsTrigger: boolean;
  body: string;
  /** The text between the argument list and the body: language, volatility, security and search path. */
  header: string;
}

const withoutComments = (sql: string): string => sql.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--.*$/gm, '');

/** Function bodies replaced by `$$`, so a `;` inside one does not split a statement. */
const withoutBodies = (sql: string): string => sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, '$$$$');

const statementsOf = (sql: string): string[] => withoutBodies(sql).split(';').map((statement) => statement.trim().toLowerCase());

function functionsOf(sql: string): FunctionDeclaration[] {
  const found = sql.matchAll(
    /create (?:or replace )?function (public\.\w+)\s*\(([^)]*)\)([\s\S]*?)\$(\w*)\$([\s\S]*?)\$\4\$/gi,
  );

  return [...found].map((match) => ({
    name: match[1].toLowerCase(),
    returnsTrigger: /returns\s+trigger/i.test(match[3]),
    header: match[3].toLowerCase(),
    body: match[5].toLowerCase(),
  }));
}

const tablesOf = (sql: string): string[] =>
  [...sql.matchAll(/create table (?:if not exists )?(public\.\w+)/gi)].map((match) => match[1].toLowerCase());

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when a statement revokes execute on the function from `role`. */
function revokes(statements: string[], name: string, role: string): boolean {
  return statements.some(
    (statement) =>
      new RegExp(`^revoke\\b[^]*\\bon function ${escape(name)}\\s*\\([^)]*\\)\\s+from\\b[^]*\\b${role}\\b`).test(statement),
  );
}

function grantsExecuteToAuthenticated(statements: string[], name: string): boolean {
  return statements.some((statement) =>
    new RegExp(`^grant\\b[^]*\\bon function ${escape(name)}\\s*\\([^)]*\\)\\s+to\\b[^]*\\bauthenticated\\b`).test(statement),
  );
}

/**
 * A function a signed-in account can call. Supabase grants execute on every new function in
 * `public` to `anon` and `authenticated` unless the migration revokes it, so a function that
 * revokes nothing is callable, and so is one that grants `authenticated` back.
 */
function callableBySignedInAccounts(statements: string[], name: string, returnsTrigger: boolean): boolean {
  if (returnsTrigger) {
    return false;
  }

  return grantsExecuteToAuthenticated(statements, name) || !revokes(statements, name, 'authenticated');
}

/** Position of the first statement in a function body that reads or writes a table. */
function firstDataAccess(body: string): number {
  const access = body.search(/\b(from|into|update|join)\s+public\./);

  return access < 0 ? body.length : access;
}

/** Every way the given migrations break ADR-0005. Empty when they keep it. */
export function adminRuleViolations(migrations: readonly Migration[]): string[] {
  const violations: string[] = [];

  for (const { name, sql: raw } of migrations) {
    const sql = withoutComments(raw);
    const code = sql.toLowerCase();
    const statements = statementsOf(sql);
    const version = name.slice(0, 14);
    const selected = /admin/i.test(name) || code.includes('public.admins') || code.includes('is_admin(');
    const fail = (message: string): number => violations.push(`${name}: ${message}`);

    for (const table of tablesOf(sql)) {
      if (!selected && !/admin/.test(table)) {
        continue;
      }

      const on = escape(table);

      if (!statements.some((statement) => new RegExp(`^alter table ${on} enable row level security$`).test(statement))) {
        fail(`${table} must enable row-level security`);
      }
      if (!statements.some((statement) => new RegExp(`^revoke all on (?:table )?${on} from anon, authenticated(?:, service_role)?$`).test(statement))) {
        fail(`${table} must revoke all from anon and authenticated`);
      }
      if (statements.some((statement) => new RegExp(`^create policy\\b[^]*\\bon ${on}\\b`).test(statement))) {
        fail(`${table} must have no policy`);
      }
      if (statements.some((statement) => new RegExp(`^grant\\b[^]*\\bon (?:table )?${on}\\b`).test(statement))) {
        fail(`${table} must not be granted to anyone`);
      }
    }

    for (const fn of functionsOf(sql)) {
      const adminNamed = /admin/.test(fn.name);
      const reachable = callableBySignedInAccounts(statements, fn.name, fn.returnsTrigger);
      const listed = NOT_ADMIN_FUNCTIONS.includes(fn.name);
      const isTheCheck = fn.name === IS_ADMIN;
      const needsPosture = (selected || adminNamed) && !fn.returnsTrigger;
      const needsGuard = !isTheCheck && !listed && (adminNamed || (reachable && (selected || version >= GUARDED_FROM)));

      if (needsPosture) {
        // A function callable by no API role (an internal helper) has no caller to run as; the rest run as their owner.
        const needsDefiner = adminNamed || reachable;

        if (needsDefiner && !/security definer\s+set search_path = ''/.test(fn.header)) {
          fail(`${fn.name} must run as its owner with an empty search path`);
        }
        if (!needsDefiner && !/set search_path = ''/.test(fn.header)) {
          fail(`${fn.name} must have an empty search path`);
        }
        if (!revokes(statements, fn.name, 'public') || !revokes(statements, fn.name, 'anon')) {
          fail(`${fn.name} must revoke execute from public and anon`);
        }
        if (statements.some((statement) => new RegExp(`^grant\\b[^]*\\bon function ${escape(fn.name)}\\s*\\([^)]*\\)\\s+to\\b[^]*\\b(anon|public)\\b`).test(statement))) {
          fail(`${fn.name} must not be granted to anon or public`);
        }
      }

      if (needsGuard) {
        const guard = fn.body.indexOf(`${IS_ADMIN}()`);

        if (guard < 0 || guard > firstDataAccess(fn.body)) {
          fail(`${fn.name} is callable by signed-in accounts, so it must call public.is_admin() before it touches a table, or be listed in NOT_ADMIN_FUNCTIONS`);
        }
      }
    }

    if (name !== ADMIN_MIGRATION) {
      for (const statement of statements) {
        if (!statement.includes('public.admins')) {
          continue;
        }
        if (/^grant\b/.test(statement) || /\bpolicy\b/.test(statement) || /(?:disable|no force) row level security/.test(statement)) {
          fail(`public.admins must keep its posture (found: ${statement.slice(0, 60)}...)`);
        }
        if (/^insert\s+into\s+public\.admins\b/.test(statement)) {
          fail('a migration must not make anyone an administrator');
        }
      }
    }
  }

  return violations;
}
