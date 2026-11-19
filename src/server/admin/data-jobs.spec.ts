import type { DataJobKey, DataJobRunAnswer, DataJobsAnswer } from '../../contracts/admin-data-jobs.model';
import type { AccountRequest } from '../account/account-session';
import type { AuthGateway } from '../auth/auth-gateway';
import type { BeginDataJobResult } from '../../contracts/admin-data-jobs.parse';
import type { AdminContext } from './admin-routes';
import { readDataJobs, runDataJob, type SyncJobRunners } from './data-jobs';
import type { SyncJobResult } from './sync-jobs';

const TOKENS = { accessToken: 'access.jwt.value', refreshToken: 'refresh-value' };
const RETRY_AT = '2026-11-04T10:01:00.000Z';

/** Records what the route asked of the database, in order, so a test can see what came before what. */
function setup(overrides: Partial<AuthGateway> = {}) {
  const order: string[] = [];
  const gateway = {
    beginDataJob: async (_tokens, job): Promise<BeginDataJobResult> => {
      order.push(`begin ${job}`);

      return { status: 'started', runId: 41 };
    },
    runRebuildJob: async (_tokens, runId) => {
      order.push(`rebuild ${runId}`);

      return 2;
    },
    finishDataJob: async (_tokens, runId, outcome) => {
      order.push(`finish ${runId} ${outcome}`);

      return true;
    },
    readDataJobs: async () => [],
    ...overrides,
  } as AuthGateway;
  const syncs: SyncJobRunners = {
    'home-news': async (): Promise<SyncJobResult> => {
      order.push('sync home-news');

      return { outcome: 'succeeded', detail: { result: 'news-synced', cards: 4 } };
    },
  };
  const context = (body: unknown): AdminContext => ({
    request: {
      method: 'POST',
      route: 'admin/data-jobs-run',
      query: new URLSearchParams(),
      host: 'rivalspulse.com',
      body,
    } satisfies AccountRequest,
    tokens: TOKENS,
    gateway,
  });

  return { order, syncs, context };
}

const asRun = (body: unknown): DataJobRunAnswer['run'] => (body as DataJobRunAnswer).run;

describe('readDataJobs', () => {
  it('answers the jobs the database reports, read with the admin\'s own tokens', async () => {
    const readDataJobs$ = jasmine.createSpy('readDataJobs').and.resolveTo([]);
    const { context } = setup({ readDataJobs: readDataJobs$ });

    const response = await readDataJobs(context(undefined));

    expect(response.status).toBe(200);
    expect((response.body as DataJobsAnswer).jobs).toEqual([]);
    expect(readDataJobs$).toHaveBeenCalledOnceWith(TOKENS);
  });
});

describe('runDataJob', () => {
  describe('the allow-list', () => {
    it('refuses a job that is not listed, and a body that is not a job key, before the database is asked', async () => {
      const { order, context, syncs } = setup();

      for (const body of [
        undefined,
        {},
        { job: 'drop-everything' },
        { job: 'recompute-hero-aggregates; drop table public.admins' },
        { job: '' },
        { job: 7 },
        { job: ['home-news'] },
        'home-news',
      ]) {
        const response = await runDataJob(context(body), syncs);

        expect(response.status).toBe(400);
      }

      expect(order).toEqual([]);
    });
  });

  describe('when the job is busy', () => {
    it('answers 409 with why and when to retry, and runs nothing, for a rebuild and for a sync', async () => {
      for (const job of ['recompute-hero-aggregates', 'home-news'] as const) {
        const { order, context, syncs } = setup({
          beginDataJob: async (): Promise<BeginDataJobResult> => ({ status: 'busy', reason: 'cooldown', retryAt: RETRY_AT }),
        });

        const response = await runDataJob(context({ job }), syncs);

        expect(response.status).toBe(409);
        expect(response.body).toEqual({ error: 'This job ran a moment ago.', reason: 'cooldown', retryAt: RETRY_AT });
        expect(order).toEqual([]);
      }
    });

    it('says a running job is running', async () => {
      const { context, syncs } = setup({
        beginDataJob: async (): Promise<BeginDataJobResult> => ({ status: 'busy', reason: 'running', retryAt: RETRY_AT }),
      });

      const response = await runDataJob(context({ job: 'home-news' }), syncs);

      expect(response.status).toBe(409);
      expect((response.body as { error: string }).error).toBe('This job is already running.');
    });
  });

  describe('a rebuild', () => {
    it('writes the audit row before it rebuilds, then lets the database close the row', async () => {
      const { order, context, syncs } = setup();

      const response = await runDataJob(context({ job: 'recompute-hero-aggregates' }), syncs);

      expect(order).toEqual(['begin recompute-hero-aggregates', 'rebuild 41']);
      expect(response.status).toBe(200);
      expect(asRun(response.body)).toEqual({
        job: 'recompute-hero-aggregates',
        outcome: 'succeeded',
        detail: { result: 'rebuilt', halfSeasons: 2 },
        recorded: true,
      });
    });

    it('closes the row as failed when the rebuild fails or runs out of time, and does not repeat the error text', async () => {
      spyOn(console, 'warn');
      const { order, context, syncs } = setup({
        runRebuildJob: async () => {
          throw new Error('canceling statement due to statement timeout (secret detail)');
        },
      });

      const response = await runDataJob(context({ job: 'recompute-play-time-aggregates' }), syncs);
      const run = asRun(response.body);

      expect(order).toEqual(['begin recompute-play-time-aggregates', 'finish 41 failed']);
      expect(response.status).toBe(200);
      expect(run.outcome).toBe('failed');
      expect(run.recorded).toBeTrue();
      expect(JSON.stringify(response.body)).not.toContain('secret detail');
    });

    it('never runs a sync for a rebuild', async () => {
      const { order, context, syncs } = setup();

      await runDataJob(context({ job: 'recompute-extended-aggregates' }), syncs);

      expect(order.filter((step) => step.startsWith('sync'))).toEqual([]);
    });
  });

  describe('a sync', () => {
    it('runs only after the audit row is written, and closes the row with what it came to', async () => {
      const finish = jasmine.createSpy('finishDataJob').and.resolveTo(true);
      const { order, context, syncs } = setup({ finishDataJob: finish });

      const response = await runDataJob(context({ job: 'home-news' }), syncs);

      expect(order).toEqual(['begin home-news', 'sync home-news']);
      expect(finish).toHaveBeenCalledOnceWith(TOKENS, 41, 'succeeded', { result: 'news-synced', cards: 4 });
      expect(asRun(response.body).recorded).toBeTrue();
    });

    it('runs the sync the key names, and no other', async () => {
      const { order, context, syncs } = setup();

      await runDataJob(context({ job: 'home-news' }), syncs);

      expect(order).toEqual(['begin home-news', 'sync home-news', 'finish 41 succeeded']);
    });

    it('reports a failed sync as a failed run and closes the row as failed', async () => {
      const { order, context, syncs } = setup();
      const failing: SyncJobRunners = {
        ...syncs,
        'home-news': async (): Promise<SyncJobResult> => ({
          outcome: 'failed',
          detail: { result: 'failed', message: 'Reading the official site took longer than 30 seconds; the earlier news is kept' },
        }),
      };

      const response = await runDataJob(context({ job: 'home-news' }), failing);

      expect(order).toEqual(['begin home-news', 'finish 41 failed']);
      expect(asRun(response.body).outcome).toBe('failed');
      expect(asRun(response.body).detail).toEqual({
        result: 'failed',
        message: 'Reading the official site took longer than 30 seconds; the earlier news is kept',
      });
    });

    it('still answers how the run ended when its audit row cannot be closed, and says it was not recorded', async () => {
      spyOn(console, 'warn');
      const { context, syncs } = setup({
        finishDataJob: async () => {
          throw new Error('database down');
        },
      });

      const response = await runDataJob(context({ job: 'home-news' }), syncs);

      expect(response.status).toBe(200);
      expect(asRun(response.body).outcome).toBe('succeeded');
      expect(asRun(response.body).recorded).toBeFalse();
    });
  });

  it('does not start anything when the database cannot begin the run', async () => {
    const { order, context, syncs } = setup({
      beginDataJob: async (_tokens, job: DataJobKey) => {
        order.push(`begin ${job}`);
        throw new Error('down');
      },
    });

    await expectAsync(runDataJob(context({ job: 'home-news' }), syncs)).toBeRejectedWithError('down');
    expect(order).toEqual(['begin home-news']);
  });
});
