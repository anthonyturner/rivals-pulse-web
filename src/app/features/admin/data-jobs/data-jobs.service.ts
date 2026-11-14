import { Injectable, signal, type DestroyRef, type Signal } from '@angular/core';

import type { DataJobBusyAnswer, DataJobKey, DataJobRunAnswer, DataJobStatus } from '../../../../contracts/admin-data-jobs.model';
import { dataJobBusyAnswerOf, dataJobRunAnswerOf, dataJobStatusesOf } from '../../../../contracts/admin-data-jobs.parse';

export type DataJobsRead = { status: 'ready'; jobs: DataJobStatus[] } | { status: 'unavailable' };

export type DataJobRunResult =
  | { status: 'finished'; run: DataJobRunAnswer['run'] }
  /** The job did not start because it is running or ran a moment ago. */
  | { status: 'busy'; busy: DataJobBusyAnswer }
  /** The server refused the request (not signed in, not an administrator, or not a job), so nothing started. */
  | { status: 'refused' }
  /** The request did not come back with an answer this page can read, so what happened is not known. */
  | { status: 'unknown' };

/**
 * The admin data jobs API. Every answer is checked before the page sees it, and a call that fails
 * is reported as such, never as a job that ran.
 */
@Injectable({ providedIn: 'root' })
export class DataJobsService {
  /** The clock, apart so a test can set the time. */
  now(): number {
    return Date.now();
  }

  /** A clock that moves every second until `destroyRef` ends. */
  tickingClock(destroyRef: DestroyRef): Signal<number> {
    const clock = signal(this.now());
    const timer = setInterval(() => clock.set(this.now()), 1000);

    destroyRef.onDestroy(() => clearInterval(timer));

    return clock.asReadonly();
  }

  async read(): Promise<DataJobsRead> {
    try {
      const response = await fetch('/api/admin/data-jobs');
      const jobs = response.ok ? dataJobStatusesOf(((await response.json()) as { jobs?: unknown } | null)?.jobs) : undefined;

      return jobs ? { status: 'ready', jobs } : { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  async run(job: DataJobKey): Promise<DataJobRunResult> {
    try {
      const response = await fetch('/api/admin/data-jobs-run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job }),
      });
      const body: unknown = await response.json().catch(() => undefined);

      if ([400, 401, 403].includes(response.status)) {
        return { status: 'refused' };
      }

      if (response.status === 409) {
        const busy = dataJobBusyAnswerOf(body);

        return busy ? { status: 'busy', busy } : { status: 'unknown' };
      }

      const run = response.ok ? dataJobRunAnswerOf(body) : undefined;

      return run ? { status: 'finished', run } : { status: 'unknown' };
    } catch {
      return { status: 'unknown' };
    }
  }
}
