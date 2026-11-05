import { DataJobsService } from './data-jobs.service';

function answer(status: number, body?: unknown): jasmine.Spy<typeof fetch> {
  return spyOn(globalThis, 'fetch').and.resolveTo(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

describe('DataJobsService', () => {
  const service = new DataJobsService();

  it('reads the jobs', async () => {
    const fetched = answer(200, { jobs: [{ job: 'game-stats', lastScheduled: null, lastManual: null, wait: null }] });

    expect(await service.read()).toEqual({
      status: 'ready',
      jobs: [{ job: 'game-stats', lastScheduled: null, lastManual: null, wait: null }],
    });
    expect(fetched).toHaveBeenCalledOnceWith('/api/admin/data-jobs');
  });

  it('reports the jobs as unavailable on a refusal or an answer it does not recognise', async () => {
    answer(403, { error: 'no' });
    expect(await service.read()).toEqual({ status: 'unavailable' });

    (globalThis.fetch as jasmine.Spy<typeof fetch>).and.resolveTo(
      new Response(JSON.stringify({ jobs: [{ job: 'drop-everything' }] }), { status: 200 }),
    );
    expect(await service.read()).toEqual({ status: 'unavailable' });

    (globalThis.fetch as jasmine.Spy<typeof fetch>).and.rejectWith(new TypeError('offline'));
    expect(await service.read()).toEqual({ status: 'unavailable' });
  });

  it('posts only the job key and reads back how the run ended', async () => {
    const fetched = answer(200, {
      run: {
        job: 'game-stats',
        outcome: 'succeeded',
        recorded: true,
        detail: { result: 'stored', capturedAt: '2026-11-04T10:10:00Z', games: 5 },
      },
    });

    const result = await service.run('game-stats');

    expect(result.status).toBe('finished');
    expect(fetched.calls.mostRecent().args[0]).toBe('/api/admin/data-jobs-run');
    expect(fetched.calls.mostRecent().args[1]).toEqual(
      jasmine.objectContaining({ method: 'POST', body: JSON.stringify({ job: 'game-stats' }) }),
    );
  });

  it('reads a 409 as a job that did not start', async () => {
    answer(409, { error: 'This job ran a moment ago.', reason: 'cooldown', retryAt: '2026-11-04T10:01:00.000Z' });

    expect(await service.run('home-news')).toEqual({
      status: 'busy',
      busy: { error: 'This job ran a moment ago.', reason: 'cooldown', retryAt: '2026-11-04T10:01:00.000Z' },
    });
  });

  it('never reports a run it cannot read as one that ran', async () => {
    const fetched = answer(500, { error: 'Something went wrong.' });

    expect(await service.run('game-stats')).toEqual({ status: 'unknown' });

    fetched.and.resolveTo(new Response(JSON.stringify({ run: { job: 'game-stats' } }), { status: 200 }));
    expect(await service.run('game-stats')).toEqual({ status: 'unknown' });

    fetched.and.rejectWith(new TypeError('offline'));
    expect(await service.run('game-stats')).toEqual({ status: 'unknown' });
  });
});
