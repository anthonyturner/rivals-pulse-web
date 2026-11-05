import type { DataJobRun } from '../../../../contracts/admin-data-jobs.model';
import { describeDetail, describeRun, utcLabel, utcTimeLabel } from './data-jobs.describe';

const AT = '2026-11-04T10:10:00.000Z';

describe('utcLabel', () => {
  it("writes the instant in UTC whatever the visitor's time zone", () => {
    expect(utcLabel('2026-11-04T09:07:31.123Z')).toBe('2026-11-04 09:07 UTC');
  });
});

describe('utcTimeLabel', () => {
  it('keeps the seconds, so a time to retry at is never named a minute too early', () => {
    expect(utcTimeLabel('2026-11-05T05:26:43.900Z')).toBe('2026-11-05 05:26:43 UTC');
  });
});

describe('describeDetail', () => {
  it('tells a clean capture as good, with every count read from Steam', () => {
    expect(describeDetail({ result: 'stored', capturedAt: AT, games: 5 })).toEqual(
      jasmine.objectContaining({ tone: 'good', headline: jasmine.stringMatching(/all 5 player counts read from Steam/) }),
    );
  });

  it('warns when Steam was unavailable and the hour now keeps the built-in numbers', () => {
    const words = describeDetail({ result: 'stored-with-fallbacks', capturedAt: AT, games: 5, fallbackGames: 2 });

    expect(words.tone).toBe('warning');
    expect(words.headline).toContain('Steam did not answer for 2 of 5 games');
    expect(words.note).toContain('will not replace these');
  });

  it('says nothing was stored when the hour was already captured, and when that was', () => {
    const words = describeDetail({ result: 'already-captured', capturedAt: '2026-11-04T10:02:00.000Z', games: 5, fallbackGames: 0 });

    expect(words.tone).toBe('notice');
    expect(words.headline).toBe('Nothing new was stored: this hour was already captured at 2026-11-04 10:02 UTC.');
  });

  it('adds that Steam also missed, and was not kept, when the hour was taken', () => {
    const words = describeDetail({ result: 'already-captured', capturedAt: AT, games: 5, fallbackGames: 5 });

    expect(words.note).toContain('Steam did not answer for 5 of 5 games on this run, and none of what it read was kept');
  });

  it('says a rebuild that changed nothing found nothing to rebuild, and counts the rest', () => {
    expect(describeDetail({ result: 'rebuilt', halfSeasons: 0 }).tone).toBe('notice');
    expect(describeDetail({ result: 'rebuilt', halfSeasons: 1 }).headline).toBe('Rebuilt 1 half-season.');
    expect(describeDetail({ result: 'rebuilt', halfSeasons: 3 }).headline).toBe('Rebuilt 3 half-seasons.');
  });

  it('shows a failure as the message it carries', () => {
    expect(describeDetail({ result: 'failed', message: 'It broke' })).toEqual({ tone: 'bad', headline: 'It broke', note: null });
  });
});

describe('describeRun', () => {
  const base: DataJobRun = { outcome: 'succeeded', startedAt: AT, finishedAt: AT, detail: null, message: null };

  it('says a run that never reported its end did not finish, never that it succeeded', () => {
    const words = describeRun({ ...base, outcome: 'unfinished', finishedAt: null });

    expect(words.tone).toBe('warning');
    expect(words.headline).toBe('Did not finish.');
  });

  it("tells a manual run by what it came to, and a scheduled one by how it ended with the scheduler's message", () => {
    expect(describeRun({ ...base, detail: { result: 'news-synced', cards: 4 } }).headline).toBe('Home news refreshed with 4 cards.');
    expect(describeRun({ ...base, outcome: 'failed', message: 'HTTP 503' })).toEqual({ tone: 'bad', headline: 'Failed.', note: 'HTTP 503' });
    expect(describeRun(base)).toEqual({ tone: 'good', headline: 'Succeeded.', note: null });
  });
});
