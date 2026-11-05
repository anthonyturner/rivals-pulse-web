import { fakeSupabaseClient } from '../../supabase/fake-supabase-client';
import { syncHomeNews } from './home-news-sync';

/** A read that never answers until its signal gives up, like a site that has stopped responding. */
function hangingFetch(): typeof fetch {
  return ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    })) as unknown as typeof fetch;
}

describe('syncHomeNews', () => {
  it('fails the run when the official site does not answer in time, and saves nothing', async () => {
    spyOn(globalThis, 'fetch').and.callFake(hangingFetch());
    const { client, calls } = fakeSupabaseClient(() => ({ data: { id: 7 } }));

    await expectAsync(syncHomeNews(client, { fetchTimeoutMs: 20 })).toBeRejectedWithError(
      'Reading the official site took longer than 0.02 seconds; the earlier news is kept',
    );

    expect(calls.map((call) => call.table)).toEqual(['sync_runs', 'sync_runs']);

    const update = calls[1].steps.find(([method]) => method === 'update')![1][0] as Record<string, unknown>;
    expect(update['status']).toBe('error');
    expect(update['message']).toContain('took longer than');
  });

  it('marks the run as the administrator\'s only when asked', async () => {
    spyOn(globalThis, 'fetch').and.callFake(hangingFetch());
    const rowsOf = async (options: { byAdmin?: boolean }): Promise<Record<string, unknown>> => {
      const { client, calls } = fakeSupabaseClient(() => ({ data: { id: 7 } }));

      await syncHomeNews(client, { fetchTimeoutMs: 5, ...options }).catch(() => undefined);

      return calls[0].steps.find(([method]) => method === 'insert')![1][0] as Record<string, unknown>;
    };

    expect((await rowsOf({ byAdmin: true }))['by_admin']).toBeTrue();
    expect('by_admin' in (await rowsOf({}))).toBeFalse();
  });

  it('fails the run, and saves nothing, when the site answers with a page that holds no news card', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response('<html><body>Just a moment...</body></html>', { status: 200 }));
    const { client, calls } = fakeSupabaseClient(() => ({ data: { id: 7 } }));

    await expectAsync(syncHomeNews(client)).toBeRejectedWithError(
      'The official site answered with no news cards; the earlier news is kept',
    );

    expect(calls.map((call) => call.table)).toEqual(['sync_runs', 'sync_runs']);
    expect(calls[1].steps.find(([method]) => method === 'update')![1][0]).toEqual(
      jasmine.objectContaining({ status: 'error', message: jasmine.stringMatching(/no news cards/) }),
    );
  });

  it('keeps a failure that is not a timeout as it was', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response('nope', { status: 503, statusText: 'Unavailable' }));
    const { client } = fakeSupabaseClient(() => ({ data: { id: 7 } }));

    await expectAsync(syncHomeNews(client)).toBeRejectedWithError(
      /Fetch failed for https:\/\/www\.marvelrivals\.com\/index\.html: HTTP 503/,
    );
  });
});
