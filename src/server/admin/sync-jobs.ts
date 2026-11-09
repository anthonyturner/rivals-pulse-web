import type { DataJobDetail } from '../../contracts/admin-data-jobs.model.ts';
import { syncHomeNews } from '../content/home/index.ts';
import { getSupabaseClient } from '../supabase/index.ts';
import { describeGameStatsCapture, recordSyncRun, runGameStatsCapture } from '../sync/index.ts';

/**
 * The only place the admin area uses the service-role key, and only through these two functions
 * (ADR-0005, decision 6). Each opens the shared client, which is the one thing here that holds the
 * key, after `admin_begin_run` has said yes to this administrator and this job. Both run the same
 * code as the Vercel cron route, called directly: the cron route's `CRON_SECRET` is neither read
 * nor needed, because the administrator has already been proved to the database.
 *
 * A sync does not throw. It answers how it ended, so the caller can close the audit row either way.
 */
export interface SyncJobResult {
  outcome: 'succeeded' | 'failed';
  detail: DataJobDetail;
}

const failed = (error: unknown): SyncJobResult => ({
  outcome: 'failed',
  detail: { result: 'failed', message: error instanceof Error ? error.message : String(error) },
});

export async function runHomeNewsJob(): Promise<SyncJobResult> {
  try {
    const synced = await syncHomeNews(getSupabaseClient(), { byAdmin: true });

    return { outcome: 'succeeded', detail: { result: 'news-synced', cards: synced.latestNews.length } };
  } catch (error) {
    return failed(error);
  }
}

export async function runGameStatsJob(): Promise<SyncJobResult> {
  try {
    const capture = await runGameStatsCapture(getSupabaseClient(), recordSyncRun, { byAdmin: true });

    // A capture that was not stored carries values but no row: that is a failure, not a success.
    return capture.failure === undefined
      ? { outcome: 'succeeded', detail: describeGameStatsCapture(capture) }
      : failed(new Error(capture.failure));
  } catch (error) {
    return failed(error);
  }
}
