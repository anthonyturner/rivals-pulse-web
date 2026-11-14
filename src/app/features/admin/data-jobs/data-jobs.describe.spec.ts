import type { DataJobRun } from '../../../../contracts/admin-data-jobs.model';
import { describeDetail, describeRun, easternLabel, easternTimeLabel } from './data-jobs.describe';

const AT = '2026-11-04T10:10:00.000Z';

describe('easternLabel', () => {
  it("writes the instant in US Eastern time whatever the visitor's time zone", () => {
    expect(easternLabel('2026-11-04T09:07:31.123Z')).toBe('Nov 4, 2026, 4:07 AM EST');
  });

  it('says EDT while daylight saving applies', () => {
    expect(easternLabel('2026-07-04T16:30:00.000Z')).toBe('Jul 4, 2026, 12:30 PM EDT');
  });

  it('tells the repeated hour apart when daylight saving ends', () => {
    expect(easternLabel('2026-11-01T05:30:00.000Z')).toBe('Nov 1, 2026, 1:30 AM EDT');
    expect(easternLabel('2026-11-01T06:30:00.000Z')).toBe('Nov 1, 2026, 1:30 AM EST');
  });
});

describe('easternTimeLabel', () => {
  it('keeps the seconds, so a time to retry at is never named a minute too early', () => {
    expect(easternTimeLabel('2026-11-05T05:26:43.900Z')).toBe('Nov 5, 2026, 12:26:43 AM EST');
  });
});

describe('describeDetail', () => {
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
