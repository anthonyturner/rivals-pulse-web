import {
  isDataJobKey,
  type DataJobBusyAnswer,
  type DataJobKey,
  type DataJobRunAnswer,
  type DataJobsAnswer,
} from '../../contracts/admin-data-jobs.model.ts';
import { json, type AccountResponse } from '../account/account-session.ts';
import type { AdminContext } from './admin-routes.ts';
import type { SyncJobResult } from './sync-jobs.ts';

/** The syncs, by job key. A test passes stand-ins. */
export type SyncJobRunners = Readonly<Record<'home-news' | 'game-stats', () => Promise<SyncJobResult>>>;

/**
 * The real syncs. `sync-jobs.ts` is loaded only when one is called, which is after `admin_begin_run`
 * has said yes: no other request, and no test of the gate, loads the module that holds the
 * service key, or the Supabase client behind it (which the install-free CI job cannot resolve).
 */
const SYNC_JOB_RUNNERS: SyncJobRunners = {
  'home-news': async () => (await import('./sync-jobs.ts')).runHomeNewsJob(),
  'game-stats': async () => (await import('./sync-jobs.ts')).runGameStatsJob(),
};

/** What a rebuild that failed or was stopped says. The cause stays in the server log. */
const REBUILD_FAILED =
  'The rebuild did not finish. The database either failed it or stopped it for taking too long. ' +
  'If the answer was lost it may still have been applied, so check "Last manual run" before trying again.';

/** Each job's last scheduled run, last manual run, and whether it can start now. */
export async function readDataJobs({ tokens, gateway }: AdminContext): Promise<AccountResponse> {
  const answer: DataJobsAnswer = { jobs: await gateway.readDataJobs(tokens) };

  return json(200, answer);
}

/**
 * Starts one job by key and answers how it ended. The audit row is written and committed first, by
 * the database, which also refuses a key outside the allow-list, a run while one is open, and a run
 * inside the cooldown (409 with the time to try again). A job that then fails still answers 200: the
 * request worked, and the job's failure is the answer.
 */
export async function runDataJob(
  { request, tokens, gateway }: AdminContext,
  syncs: SyncJobRunners = SYNC_JOB_RUNNERS,
): Promise<AccountResponse> {
  const job = (request.body as { job?: unknown } | undefined)?.job;

  if (!isDataJobKey(job)) {
    return json(400, { error: 'Choose one of the listed jobs.' });
  }

  const begun = await gateway.beginDataJob(tokens, job);

  if (begun.status === 'busy') {
    const busy: DataJobBusyAnswer = {
      error: begun.reason === 'running' ? 'This job is already running.' : 'This job ran a moment ago.',
      reason: begun.reason,
      retryAt: begun.retryAt,
    };

    return json(409, busy);
  }

  const result = await execute(job, async () => ({ halfSeasons: await gateway.runRebuildJob(tokens, begun.runId) }), syncs);
  const recorded = result.closed || (await close(job, () => gateway.finishDataJob(tokens, begun.runId, result.outcome, result.detail)));
  const answer: DataJobRunAnswer = { run: { job, outcome: result.outcome, detail: result.detail, recorded } };

  return json(200, answer);
}

interface Execution extends SyncJobResult {
  /** True when the database closed the audit row in the same transaction as the job. */
  closed: boolean;
}

/** Runs the job. It never throws: how it ended is the result, and the audit row is closed from it. */
async function execute(
  job: DataJobKey,
  rebuild: () => Promise<{ halfSeasons: number }>,
  syncs: SyncJobRunners,
): Promise<Execution> {
  const sync = job === 'home-news' || job === 'game-stats' ? syncs[job] : undefined;

  if (sync) {
    return { ...(await sync()), closed: false };
  }

  try {
    const { halfSeasons } = await rebuild();

    return { outcome: 'succeeded', detail: { result: 'rebuilt', halfSeasons }, closed: true };
  } catch (error) {
    console.warn('An admin rebuild did not finish:', job, error instanceof Error ? error.message : error);

    return { outcome: 'failed', detail: { result: 'failed', message: REBUILD_FAILED }, closed: false };
  }
}

/** Closes the audit row. True when the row now says how the run ended. */
async function close(job: DataJobKey, finish: () => Promise<boolean>): Promise<boolean> {
  try {
    return await finish();
  } catch (error) {
    // The row stays open and reads as unfinished after ten minutes; the answer still says how the run ended.
    console.warn('An admin run could not be closed:', job, error instanceof Error ? error.message : error);

    return false;
  }
}
