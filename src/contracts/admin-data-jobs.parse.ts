import {
  isDataJobKey,
  type DataJobBusyAnswer,
  type DataJobDetail,
  type DataJobOutcome,
  type DataJobRun,
  type DataJobRunAnswer,
  type DataJobStatus,
  type DataJobWait,
} from './admin-data-jobs.model.ts';

/**
 * Readers for what the admin database functions answer, and for what the admin routes answer the
 * page. A shape they do not recognise is refused (undefined), so nothing shows a guess. The job list
 * is the one place that gives way: a job whose entry cannot be read is left out, and a scheduled run
 * that cannot be read reads as none, so one odd row never takes the other jobs down. A run's `detail`
 * may also be missing, because it is the one part a row written by older code could lack.
 */

/** The database's answer to starting a job. */
export type BeginDataJobResult =
  | { status: 'started'; runId: number }
  | ({ status: 'busy' } & DataJobWait);

const OUTCOMES: readonly DataJobOutcome[] = ['succeeded', 'failed', 'running', 'unfinished'];

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Postgres writes a timestamptz as `2026-11-04T10:00:03.279+00:00`; the page gets the `toISOString()` form. */
function instantOf(value: unknown): string | undefined {
  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;

  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

function countOf(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function waitOf(value: unknown): DataJobWait | undefined {
  const wait = recordOf(value);
  const retryAt = instantOf(wait?.['retryAt']);

  return (wait?.['reason'] === 'running' || wait?.['reason'] === 'cooldown') && retryAt
    ? { reason: wait['reason'], retryAt }
    : undefined;
}

export function beginResultOf(answer: unknown): BeginDataJobResult | undefined {
  const begun = recordOf(answer);
  const runId = countOf(begun?.['runId']);

  if (begun?.['status'] === 'started' && runId !== undefined) {
    return { status: 'started', runId };
  }

  const wait = begun?.['status'] === 'busy' ? waitOf(begun) : undefined;

  return wait && { status: 'busy', ...wait };
}

/** What a finished run came to, or null when the row holds something else. */
export function dataJobDetailOf(value: unknown): DataJobDetail | null {
  const detail = recordOf(value);
  switch (detail?.['result']) {
    case 'rebuilt': {
      const halfSeasons = countOf(detail['halfSeasons']);

      return halfSeasons === undefined ? null : { result: 'rebuilt', halfSeasons };
    }
    case 'news-synced': {
      const cards = countOf(detail['cards']);

      return cards === undefined ? null : { result: 'news-synced', cards };
    }
    case 'failed':
      return typeof detail['message'] === 'string' ? { result: 'failed', message: detail['message'] } : null;
    default:
      return null;
  }
}

/** A run, or null for none. Undefined means the value is not a run at all. */
function runOf(value: unknown): DataJobRun | null | undefined {
  if (value === null) {
    return null;
  }

  const run = recordOf(value);
  const startedAt = instantOf(run?.['startedAt']);
  const outcome = OUTCOMES.find((candidate) => candidate === run?.['outcome']);
  const finishedAt = run?.['finishedAt'] === null ? null : instantOf(run?.['finishedAt']);

  if (!run || !startedAt || !outcome || finishedAt === undefined) {
    return undefined;
  }

  return {
    outcome,
    startedAt,
    finishedAt,
    detail: dataJobDetailOf(run['detail']),
    message: typeof run['message'] === 'string' && run['message'] ? run['message'] : null,
  };
}

export function dataJobStatusesOf(answer: unknown): DataJobStatus[] | undefined {
  if (!Array.isArray(answer)) {
    return undefined;
  }

  const statuses: DataJobStatus[] = [];

  for (const entry of answer as unknown[]) {
    const status = recordOf(entry);
    const job = status?.['job'];
    // The scheduler's history is read from a table this code does not own, so one row it cannot read
    // reads as no scheduled run. Anything else it cannot read leaves that one job out, not the page.
    const lastScheduled = runOf(status?.['lastScheduled']) ?? null;
    const lastManual = runOf(status?.['lastManual']);
    const wait = status?.['wait'] === null ? null : waitOf(status?.['wait']);

    if (isDataJobKey(job) && lastManual !== undefined && wait !== undefined) {
      statuses.push({ job, lastScheduled, lastManual, wait });
    }
  }

  return statuses;
}

/** The `run` of a finished run's answer, or undefined when it is not one. */
export function dataJobRunAnswerOf(body: unknown): DataJobRunAnswer['run'] | undefined {
  const run = recordOf(recordOf(body)?.['run']);
  const job = run?.['job'];
  const detail = dataJobDetailOf(run?.['detail']);
  const outcome = run?.['outcome'];

  return isDataJobKey(job) && (outcome === 'succeeded' || outcome === 'failed') && detail && typeof run?.['recorded'] === 'boolean'
    ? { job, outcome, detail, recorded: run['recorded'] }
    : undefined;
}

/** The answer to a job that was not started because it is running or ran too recently. */
export function dataJobBusyAnswerOf(body: unknown): DataJobBusyAnswer | undefined {
  const busy = recordOf(body);
  const wait = waitOf(busy);

  return wait && typeof busy?.['error'] === 'string' ? { error: busy['error'], ...wait } : undefined;
}
