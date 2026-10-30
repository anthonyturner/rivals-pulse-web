import { fakeSupabaseClient } from './fake-supabase-client';
import {
  finishSyncRun,
  getExternalSourcePayload,
  saveExternalSource,
  startSyncRun,
} from './sync-log';

describe('startSyncRun', () => {
  it('opens a running row and returns its id', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: { id: 7 } }));

    expect(await startSyncRun(client, 'official-heroes', 'Checking')).toBe(7);

    const insert = calls[0].steps.find(([method]) => method === 'insert')!;
    expect(calls[0].table).toBe('sync_runs');
    expect(insert[1][0]).toEqual(
      jasmine.objectContaining({
        source_key: 'official-heroes',
        status: 'running',
        message: 'Checking',
      }),
    );
  });

  it('names the source when it fails', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(startSyncRun(client, 'official-heroes', 'Checking')).toBeRejectedWithError(
      'Recording the official-heroes sync run failed: boom',
    );
  });
});

describe('finishSyncRun', () => {
  it('closes the row with the result and its details', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await finishSyncRun(client, 7, { status: 'success', message: 'Done', details: { added: [] } });

    const update = calls[0].steps.find(([method]) => method === 'update')!;
    expect(update[1][0]).toEqual(
      jasmine.objectContaining({ status: 'success', message: 'Done', details: { added: [] } }),
    );
    expect(calls[0].steps).toContain(['eq', ['id', 7]]);
  });

  it('stores null details when there are none', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await finishSyncRun(client, 7, { status: 'error', message: 'Failed' });

    const update = calls[0].steps.find(([method]) => method === 'update')!;
    expect(update[1][0]).toEqual(jasmine.objectContaining({ details: null }));
  });
});

describe('saveExternalSource', () => {
  it('upserts by source key', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({}));

    await saveExternalSource(client, {
      sourceKey: 'official-heroes',
      sourceName: 'Official',
      url: 'https://example.test',
      payload: { heroes: [] },
      fetchedAt: '2026-10-29T00:00:00.000Z',
      status: 'success',
      error: null,
    });

    expect(calls[0].table).toBe('external_sources');
    expect(calls[0].steps[0][0]).toBe('upsert');
    expect(calls[0].steps[0][1][1]).toEqual({ onConflict: 'source_key' });
    expect(calls[0].steps[0][1][0]).toEqual(
      jasmine.objectContaining({ source_key: 'official-heroes', payload: { heroes: [] } }),
    );
  });
});

describe('getExternalSourcePayload', () => {
  it('returns a saved payload', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: { payload: { heroes: [1] } } }));

    expect(await getExternalSourcePayload(client, 'official-heroes')).toEqual({ heroes: [1] });
  });

  it('treats a missing or empty payload as none', async () => {
    const missing = fakeSupabaseClient(() => ({ data: null })).client;
    const empty = fakeSupabaseClient(() => ({ data: { payload: {} } })).client;

    expect(await getExternalSourcePayload(missing, 'x')).toBeUndefined();
    expect(await getExternalSourcePayload(empty, 'x')).toBeUndefined();
  });
});
