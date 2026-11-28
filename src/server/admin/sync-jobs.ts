import type { DataJobDetail } from '../../contracts/admin-data-jobs.model.ts';
import { syncHomeNews } from '../content/home/index.ts';
import { getSupabaseClient } from '../supabase/index.ts';

/**
 * The only place the admin area uses the service-role key, and only through this function
 * (ADR-0005, decision 6). It opens the shared client, which is the one thing here that holds the
 * key, after `admin_begin_run` has said yes to this administrator and this job. It runs the same
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
