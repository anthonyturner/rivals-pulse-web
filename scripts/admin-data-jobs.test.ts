import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

import { DATA_JOBS, isDataJobKey } from '../src/contracts/admin-data-jobs.model.ts';
import { handleAdminRequest } from '../src/server/admin/admin-api.ts';
import type { AccountRequest } from '../src/server/account/account-session.ts';
import type { AuthGateway } from '../src/server/auth/index.ts';
import { MIGRATIONS, read } from '../supabase/functions/track-match-history/migration-sql.ts';

/**
 * The admin data jobs have one list of keys in code and the same list in SQL, and the two must not
 * drift: a job the page offers that the database refuses is a dead button, and a job the database
 * accepts that the page never lists is a door nobody reviewed. These read the migrations as text,
 * as `admin-migrations.test.ts` does, because CI starts no database; `supabase/checks/admin_data_jobs.sql`
 * proves the behaviour against the real project.
 */
const MIGRATION = '20261104150000_admin_data_jobs.sql';
const sql = read(MIGRATION).replace(/--.*$/gm, '');
const allSql = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .map((name) => read(name).replace(/--.*$/gm, ''))
  .join('\n');

const keysIn = (text: string): string[] => [...text.matchAll(/'([a-z][a-z-]+)'/g)].map((match) => match[1]);
const bodyOf = (name: string): string => {
  const match = sql.match(new RegExp(`function public\\.${name}\\([^)]*\\)[\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`));

  assert.ok(match, `${name} is declared in ${MIGRATION}`);

  return match[1];
};

describe('the job list in SQL and in code', () => {
  const codeKeys = DATA_JOBS.map((job) => job.key).sort();
  const rebuildKeys = DATA_JOBS.filter((job) => job.kind === 'rebuild').map((job) => job.key).sort();

  it('is the allow-list of the cooldown function, and nothing else', () => {
    const cases = [...bodyOf('data_job_cooldown').matchAll(/when '([^']+)' then/g)].map((match) => match[1]).sort();

    assert.deepEqual(cases, codeKeys);
  });

  it('is the list the status function reports, rebuilds and syncs apart', () => {
    const body = bodyOf('admin_data_jobs_status');
    const rebuilds = keysIn(body.match(/v_rebuilds text\[\] := array\[([\s\S]*?)\];/)?.[1] ?? '').sort();
    const syncs = keysIn(body.match(/v_syncs text\[\] := array\[([\s\S]*?)\];/)?.[1] ?? '').sort();

    assert.deepEqual(rebuilds, rebuildKeys);
    assert.deepEqual(syncs, DATA_JOBS.filter((job) => job.kind === 'sync').map((job) => job.key).sort());
  });

  it('runs exactly the rebuilds, each by the function its own cron job runs', () => {
    const body = bodyOf('admin_run_rebuild');
    const cases = [...body.matchAll(/when '([^']+)' then v_rebuilt := public\.(\w+)\(\)/g)];

    assert.deepEqual(cases.map((match) => match[1]).sort(), rebuildKeys);

    for (const [, key, fn] of cases) {
      assert.match(
        allSql,
        new RegExp(`cron\\.schedule\\('${key}', '[^']+', 'select public\\.${fn}\\(\\)'\\)`),
        `${key} is a pg_cron job that runs ${fn}()`,
      );
    }
  });

  it('names no job in code that SQL would not accept, and refuses a free-form key', () => {
    assert.ok(DATA_JOBS.every((job) => isDataJobKey(job.key)));

    for (const key of ['', 'recompute-hero-aggregates ', 'RECOMPUTE-HERO-AGGREGATES', 'hero', undefined, null, 5, {}]) {
      assert.equal(isDataJobKey(key), false);
    }
  });
});

describe('the data job functions', () => {
  it('check the administrator first, and the allow-list before they write anything', () => {
    for (const name of ['admin_begin_run', 'admin_run_rebuild', 'admin_finish_run', 'admin_data_jobs_status']) {
      assert.match(bodyOf(name).trim(), /^(declare[\s\S]*?)?begin\s+if not public\.is_admin\(\) then/i, name);
    }

    const begin = bodyOf('admin_begin_run');

    assert.ok(begin.indexOf('data_job_cooldown(p_job) is null') > -1);
    assert.ok(begin.indexOf('data_job_cooldown(p_job) is null') < begin.indexOf('insert into public.admin_audit_log'));
    assert.ok(begin.indexOf('data_job_wait(p_job)') < begin.indexOf('insert into public.admin_audit_log'));
  });

  it('write the audit row in a call that does no work, so a timeout in the work cannot take the row with it', () => {
    assert.doesNotMatch(bodyOf('admin_begin_run'), /recompute_|rebuild_/);
    assert.doesNotMatch(bodyOf('admin_run_rebuild'), /insert into public\.admin_audit_log/);
  });

  it('are granted to authenticated and no other API role, with the helpers granted to none', () => {
    for (const name of ['admin_begin_run(text)', 'admin_run_rebuild(bigint)', 'admin_finish_run(bigint, text, jsonb)', 'admin_data_jobs_status()']) {
      assert.ok(sql.includes(`revoke execute on function public.${name} from public, anon, service_role;`), name);
      assert.ok(sql.includes(`grant execute on function public.${name} to authenticated;`), name);
    }

    for (const name of ['data_job_cooldown(text)', 'data_job_unfinished_after()', 'data_job_wait(text)']) {
      assert.ok(sql.includes(`revoke execute on function public.${name} from public, anon, authenticated, service_role;`), name);
    }

    assert.doesNotMatch(sql, /grant execute[^;]*\bto\b[^;]*\b(anon|public|service_role)\b/i);
  });

  it('keep the audit log closed to every API role, and keep the actor when the account goes', () => {
    assert.match(sql, /alter table public\.admin_audit_log enable row level security;/);
    assert.match(sql, /revoke all on public\.admin_audit_log from anon, authenticated, service_role;/);
    assert.match(sql, /actor_id uuid references auth\.users \(id\) on delete set null/);
  });
});

const TOKENS = { accessToken: 'access.jwt.value', refreshToken: 'refresh-value' };
const ACCOUNT = { email: 'admin@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };

describe('the data job endpoints', () => {
  const started: string[] = [];
  const gateway = (isAdmin: boolean): AuthGateway => {
    const unused = async (): Promise<never> => {
      throw new Error('not used by the data job routes');
    };

    return {
      authorizeUrl: unused,
      exchangeCode: unused,
      resolve: async (tokens) => ({ account: ACCOUNT, tokens }),
      signOut: unused,
      deleteAccount: unused,
      linkedPlayer: unused,
      redeemLinkCode: unused,
      unlinkPlayer: unused,
      readOwnDashboard: unused,
      isAdmin: async () => isAdmin,
      beginDataJob: async () => {
        started.push('begin');

        return { status: 'started', runId: 1 };
      },
      runRebuildJob: async () => {
        started.push('rebuild');

        return 1;
      },
      finishDataJob: async () => true,
      readDataJobs: async () => {
        started.push('read');

        return [];
      },
    };
  };
  const request = (route: string, method: string, signedIn: boolean): AccountRequest => ({
    method,
    route,
    query: new URLSearchParams(),
    host: 'rivalspulse.com',
    protocol: 'https',
    originHeader: 'https://rivalspulse.com',
    cookieHeader: signedIn ? `rp_session=${TOKENS.accessToken}~${TOKENS.refreshToken}` : undefined,
    body: { job: 'recompute-hero-aggregates' },
  });

  for (const [route, method] of [['admin/data-jobs', 'GET'], ['admin/data-jobs-run', 'POST']] as const) {
    it(`${method} ${route} is 401 signed out and 403 for a non-admin, and touches no job either time`, async () => {
      started.length = 0;

      assert.equal((await handleAdminRequest(request(route, method, false), () => gateway(true))).status, 401);
      assert.equal((await handleAdminRequest(request(route, method, true), () => gateway(false))).status, 403);
      assert.deepEqual(started, []);
    });
  }

  it('POST admin/data-jobs-run is refused from another site, and starts nothing', async () => {
    started.length = 0;

    const response = await handleAdminRequest(
      { ...request('admin/data-jobs-run', 'POST', true), originHeader: 'https://evil.example' },
      () => gateway(true),
    );

    assert.equal(response.status, 403);
    assert.deepEqual(started, []);
  });

  it('POST admin/data-jobs-run starts a rebuild for an admin, writing the audit row first', async () => {
    started.length = 0;

    const response = await handleAdminRequest(request('admin/data-jobs-run', 'POST', true), () => gateway(true));

    assert.equal(response.status, 200);
    assert.deepEqual(started, ['begin', 'rebuild']);
  });
});
