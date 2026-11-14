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
  function newsCard(title: string, date: string, path: string): string {
    return `<a href="/${path}"><div class="title">${title}</div><div class="date">${date}</div></a>`;
  }

  it('selects the newest season, patch and balance posts ahead of an older promotional carousel', async () => {
    const html = `<div class="newsCms">
      ${newsCard('Promotional collection', '2026/11/04', 'promotion')}
      ${newsCard('Version 20261105 Patch Notes', '2026/11/04', 'old-patch')}
      ${newsCard('Season 10: Old story', '2026/10/09', 'old-season')}
      ${newsCard('Version 20261009 Balance Post', '2026/10/08', 'old-balance')}
      ${newsCard('Season 11: Doomsday // Dev Vision', '2026/11/12', 'new-season')}
      ${newsCard('Version 20261113 Patch Notes - Season 11 Arrives', '2026/11/11', 'new-patch')}
      ${newsCard('Version 20261113 Balance Post', '2026/11/10', 'new-balance')}
      <div class="news-tab">`;
    const fetchSpy = spyOn(globalThis, 'fetch').and.callFake(async (input) => {
      const url = String(input);
      return new Response(url.endsWith('index.html') ? html
        : url.endsWith('new-patch') ? '<h3>New Event: Season launch</h3><p>Event missions unlock rewards during the event.</p>'
        : '<div class="video_ctn" data-movieurl="/season11.mp4" data-name="Season 11 update">');
    });
    const { client } = fakeSupabaseClient(() => ({ data: { id: 7 } }));

    const result = await syncHomeNews(client);

    expect(result.seasonUpdates.map((item) => item.title)).toEqual([
      'Season 11: Doomsday // Dev Vision',
      'Version 20261113 Patch Notes - Season 11 Arrives',
      'Version 20261113 Balance Post',
    ]);
    expect(result.latestNews[0].videoUrl).toBe('https://www.marvelrivals.com/season11.mp4');
    expect(result.latestNews[1].description).toContain('Season launch');
    expect(result.latestTuning?.sourceUrl).toBe('https://www.marvelrivals.com/new-balance');
    expect(result.battlePass.currentSeason).toBe('Season 11');
    expect(fetchSpy.calls.allArgs().map(([url]) => String(url))).toEqual([
      'https://www.marvelrivals.com/index.html',
      'https://www.marvelrivals.com/new-patch',
      'https://www.marvelrivals.com/new-season',
    ]);
  });

  it('prefers the newest dated duplicate and leaves invalid or missing dates in stable order after dated news', async () => {
    const html = `<div class="newsCms">
      ${newsCard('Repeated announcement', '', 'undated-copy')}
      ${newsCard('Invalid month', '2026/13/01', 'invalid-month')}
      ${newsCard('Undated first', '', 'undated-first')}
      ${newsCard('Invalid calendar date', '2026/02/31', 'invalid')}
      ${newsCard('Repeated announcement', '2026/11/01', 'older-copy')}
      ${newsCard('Repeated announcement', '2026/11/12', 'newest-copy')}
      ${newsCard('Same-day announcement', '2026/11/12', 'same-day')}
      <div class="news-tab">`;
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(html));
    const { client } = fakeSupabaseClient(() => ({ data: { id: 7 } }));

    const result = await syncHomeNews(client);

    expect(result.latestNews.map((item) => item.sourceUrl)).toEqual([
      'https://www.marvelrivals.com/newest-copy',
      'https://www.marvelrivals.com/same-day',
      'https://www.marvelrivals.com/invalid-month',
      'https://www.marvelrivals.com/undated-first',
    ]);
    expect(result.seasonUpdates[2].date).toBe('2026/13/01');
  });

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
