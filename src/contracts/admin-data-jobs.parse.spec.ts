import {
  beginResultOf,
  dataJobBusyAnswerOf,
  dataJobDetailOf,
  dataJobRunAnswerOf,
  dataJobStatusesOf,
} from './admin-data-jobs.parse';

describe('dataJobRunAnswerOf', () => {
  it('reads a finished run, and refuses one with no detail, an unknown job or an outcome that is not final', () => {
    const run = { job: 'home-news', outcome: 'failed', recorded: false, detail: { result: 'failed', message: 'x' } };

    expect(dataJobRunAnswerOf({ run })).toEqual({
      job: 'home-news',
      outcome: 'failed',
      recorded: false,
      detail: { result: 'failed', message: 'x' },
    });
    expect(dataJobRunAnswerOf({ run: { ...run, detail: null } })).toBeUndefined();
    expect(dataJobRunAnswerOf({ run: { ...run, job: 'drop-everything' } })).toBeUndefined();
    expect(dataJobRunAnswerOf({ run: { ...run, outcome: 'running' } })).toBeUndefined();
    expect(dataJobRunAnswerOf(null)).toBeUndefined();
  });
});

describe('dataJobBusyAnswerOf', () => {
  it('reads why and when, and refuses a 409 that says neither', () => {
    expect(dataJobBusyAnswerOf({ error: 'e', reason: 'running', retryAt: '2026-11-04T10:00:10.000Z' })).toEqual({
      error: 'e',
      reason: 'running',
      retryAt: '2026-11-04T10:00:10.000Z',
    });
    expect(dataJobBusyAnswerOf({ error: 'e' })).toBeUndefined();
  });
});

describe('beginResultOf', () => {
  it('reads a started run and a busy job', () => {
    expect(beginResultOf({ status: 'started', runId: 9, startedAt: '2026-11-04T10:00:00+00:00' })).toEqual({
      status: 'started',
      runId: 9,
    });
    expect(beginResultOf({ status: 'busy', reason: 'running', retryAt: '2026-11-04T10:00:10.5+00:00' })).toEqual({
      status: 'busy',
      reason: 'running',
      retryAt: '2026-11-04T10:00:10.500Z',
    });
  });

  it('refuses anything else, so a run is never started on a guess', () => {
    for (const answer of [
      null,
      'started',
      { status: 'started' },
      { status: 'started', runId: -1 },
      { status: 'started', runId: 1.5 },
      { status: 'busy', reason: 'sleepy', retryAt: '2026-11-04T10:00:10Z' },
      { status: 'busy', reason: 'cooldown', retryAt: 'tomorrow' },
      { status: 'idle' },
    ]) {
      expect(beginResultOf(answer)).toBeUndefined();
    }
  });
});

describe('dataJobDetailOf', () => {
  it('reads each shape a run can come to', () => {
    const captured = '2026-11-04T10:10:00.000Z';

    expect(dataJobDetailOf({ result: 'rebuilt', halfSeasons: 2 })).toEqual({ result: 'rebuilt', halfSeasons: 2 });
    expect(dataJobDetailOf({ result: 'news-synced', cards: 4 })).toEqual({ result: 'news-synced', cards: 4 });
    expect(dataJobDetailOf({ result: 'stored', capturedAt: captured, games: 5 })).toEqual({
      result: 'stored',
      capturedAt: captured,
      games: 5,
    });
    expect(dataJobDetailOf({ result: 'stored-with-fallbacks', capturedAt: captured, games: 5, fallbackGames: 2 })).toEqual({
      result: 'stored-with-fallbacks',
      capturedAt: captured,
      games: 5,
      fallbackGames: 2,
    });
    expect(dataJobDetailOf({ result: 'already-captured', capturedAt: captured, games: 5, fallbackGames: 0 })).toEqual({
      result: 'already-captured',
      capturedAt: captured,
      games: 5,
      fallbackGames: 0,
    });
    expect(dataJobDetailOf({ result: 'failed', message: 'x' })).toEqual({ result: 'failed', message: 'x' });
  });

  it('reads anything else as no detail, rather than guessing', () => {
    for (const value of [
      null,
      'rebuilt',
      {},
      { result: 'rebuilt' },
      { result: 'rebuilt', halfSeasons: '2' },
      { result: 'stored', games: 5 },
      { result: 'already-captured', capturedAt: '2026-11-04T10:10:00Z', games: 5 },
      { result: 'failed', message: 4 },
      { result: 'exploded' },
    ]) {
      expect(dataJobDetailOf(value)).toBeNull();
    }
  });
});

describe('dataJobStatusesOf', () => {
  const run = {
    outcome: 'unfinished',
    startedAt: '2026-11-04T09:00:00+00:00',
    finishedAt: null,
    detail: { result: 'rebuilt', halfSeasons: 1 },
  };

  it('reads an unfinished manual run, a missing scheduled run and a wait', () => {
    expect(
      dataJobStatusesOf([
        {
          job: 'recompute-hero-pair-aggregates',
          lastScheduled: null,
          lastManual: run,
          wait: { reason: 'cooldown', retryAt: '2026-11-04T09:01:00+00:00' },
        },
      ]),
    ).toEqual([
      {
        job: 'recompute-hero-pair-aggregates',
        lastScheduled: null,
        lastManual: {
          outcome: 'unfinished',
          startedAt: '2026-11-04T09:00:00.000Z',
          finishedAt: null,
          detail: { result: 'rebuilt', halfSeasons: 1 },
          message: null,
        },
        wait: { reason: 'cooldown', retryAt: '2026-11-04T09:01:00.000Z' },
      },
    ]);
  });

  it('refuses a list with an unknown job, an unknown outcome or a missing field, and the empty list is fine', () => {
    const good = { job: 'game-stats', lastScheduled: null, lastManual: null, wait: null };

    expect(dataJobStatusesOf([])).toEqual([]);
    expect(dataJobStatusesOf([good])?.length).toBe(1);
    expect(dataJobStatusesOf({})).toBeUndefined();
    expect(dataJobStatusesOf([{ ...good, job: 'drop-everything' }])).toBeUndefined();
    expect(dataJobStatusesOf([{ ...good, lastManual: { ...run, outcome: 'nearly' } }])).toBeUndefined();
    expect(dataJobStatusesOf([{ ...good, lastScheduled: { ...run, startedAt: 'soon' } }])).toBeUndefined();
    expect(dataJobStatusesOf([{ job: 'game-stats', lastScheduled: null, lastManual: null }])).toBeUndefined();
  });
});
