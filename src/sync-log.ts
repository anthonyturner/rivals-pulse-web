import type { SupabaseClient } from '@supabase/supabase-js';

// Shared by every sync that records its runs in Supabase. No relative runtime import, for the
// same reason as hero-store.ts.

export type SyncRunStatus = 'running' | 'success' | 'error';

export interface SyncRunResult {
  status: Exclude<SyncRunStatus, 'running'>;
  message: string;
  /** Anything worth keeping about the run that does not fit in the message. */
  details?: unknown;
}

export interface ExternalSource {
  sourceKey: string;
  sourceName: string;
  url: string;
  payload: unknown;
  fetchedAt: string;
  status: 'success' | 'error';
  error: string | null;
}

/** Opens a `sync_runs` row and returns its id. */
export async function startSyncRun(
  client: SupabaseClient,
  sourceKey: string,
  message: string,
): Promise<number> {
  const { data, error } = await client
    .from('sync_runs')
    .insert({
      source_key: sourceKey,
      status: 'running',
      message,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single<{ id: number }>();

  if (error) {
    throw new Error(`Recording the ${sourceKey} sync run failed: ${error.message}`);
  }

  return data.id;
}

export async function finishSyncRun(
  client: SupabaseClient,
  runId: number,
  result: SyncRunResult,
): Promise<void> {
  const { error } = await client
    .from('sync_runs')
    .update({
      status: result.status,
      message: result.message,
      finished_at: new Date().toISOString(),
      details: result.details ?? null,
    })
    .eq('id', runId);

  if (error) {
    throw new Error(`Finishing sync run ${runId} failed: ${error.message}`);
  }
}

/**
 * Runs `work` inside a `sync_runs` row and returns what it returned. The row closes with the result
 * `describe` makes of that value, or as an error with the thrown message, which is rethrown.
 */
export async function recordSyncRun<T>(
  client: SupabaseClient,
  sourceKey: string,
  startMessage: string,
  work: () => Promise<T>,
  describe: (value: T) => SyncRunResult,
): Promise<T> {
  const runId = await startSyncRun(client, sourceKey, startMessage);
  let value: T;

  try {
    value = await work();
  } catch (error) {
    await finishSyncRun(client, runId, {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await finishSyncRun(client, runId, describe(value));

  return value;
}

export async function saveExternalSource(
  client: SupabaseClient,
  source: ExternalSource,
): Promise<void> {
  const { error } = await client.from('external_sources').upsert(
    {
      source_key: source.sourceKey,
      source_name: source.sourceName,
      url: source.url,
      payload: source.payload,
      fetched_at: source.fetchedAt,
      status: source.status,
      error: source.error,
    },
    { onConflict: 'source_key' },
  );

  if (error) {
    throw new Error(`Saving source ${source.sourceKey} failed: ${error.message}`);
  }
}

/**
 * The payload stored for a source, exactly as saved (a failed fetch saves `{}`), or undefined when
 * the source was never saved.
 */
export async function getStoredExternalSourcePayload(
  client: SupabaseClient,
  sourceKey: string,
): Promise<unknown | undefined> {
  const { data, error } = await client
    .from('external_sources')
    .select('payload')
    .eq('source_key', sourceKey)
    .maybeSingle<{ payload: unknown }>();

  if (error) {
    throw new Error(`Reading source ${sourceKey} failed: ${error.message}`);
  }

  return data?.payload ?? undefined;
}

/** The payload last saved for a source, or undefined when there is none or it is empty. */
export async function getExternalSourcePayload(
  client: SupabaseClient,
  sourceKey: string,
): Promise<unknown | undefined> {
  const payload = await getStoredExternalSourcePayload(client, sourceKey);
  const isEmpty =
    payload === undefined ||
    payload === null ||
    (typeof payload === 'object' && Object.keys(payload).length === 0);

  return isEmpty ? undefined : payload;
}

export async function countExternalSources(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from('external_sources')
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Counting external sources failed: ${error.message}`);
  }

  return count ?? 0;
}
