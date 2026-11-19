import { DATA_JOBS, GITHUB_JOBS } from '../../../../contracts/admin-data-jobs.model';
import { nextRunAt, timeLeftLabel } from './data-jobs.schedule';

const at = (iso: string): number => Date.parse(iso);

describe('nextRunAt', () => {
  it('finds the minute later in this hour, or in the next hour', () => {
    expect(nextRunAt('7 * * * *', at('2026-11-04T10:00:00Z'))).toBe(at('2026-11-04T10:07:00Z'));
    expect(nextRunAt('7 * * * *', at('2026-11-04T10:08:00Z'))).toBe(at('2026-11-04T11:07:00Z'));
  });

  it('moves on to the following run at the moment one is due', () => {
    expect(nextRunAt('7 * * * *', at('2026-11-04T10:07:00Z'))).toBe(at('2026-11-04T11:07:00Z'));
    expect(nextRunAt('7 * * * *', at('2026-11-04T10:06:59.999Z'))).toBe(at('2026-11-04T10:07:00Z'));
  });

  it('honours a step of hours', () => {
    expect(nextRunAt('17 */6 * * *', at('2026-11-04T07:00:00Z'))).toBe(at('2026-11-04T12:17:00Z'));
    expect(nextRunAt('17 */6 * * *', at('2026-11-04T18:17:00Z'))).toBe(at('2026-11-05T00:17:00Z'));
  });

  it('crosses midnight, a month and a year for a daily schedule', () => {
    expect(nextRunAt('0 3 * * *', at('2026-11-04T02:59:00Z'))).toBe(at('2026-11-04T03:00:00Z'));
    expect(nextRunAt('0 3 * * *', at('2026-11-04T03:00:00Z'))).toBe(at('2026-11-05T03:00:00Z'));
    expect(nextRunAt('30 4 * * *', at('2026-12-31T23:00:00Z'))).toBe(at('2027-01-01T04:30:00Z'));
  });

  it('reads every schedule the page declares', () => {
    const after = at('2026-11-04T10:00:00Z');

    for (const job of [...DATA_JOBS, ...GITHUB_JOBS]) {
      expect(nextRunAt(job.schedule, after)).withContext(job.key).toBeGreaterThan(after);
    }
  });
});

describe('timeLeftLabel', () => {
  it('uses hours and minutes from an hour up, and seconds below it', () => {
    expect(timeLeftLabel(5 * 3_600_000 + 12 * 60_000 + 30_000)).toBe('5h 12m');
    expect(timeLeftLabel(3_600_000)).toBe('1h 0m');
    expect(timeLeftLabel(23 * 60_000 + 12_000)).toBe('23m 12s');
    expect(timeLeftLabel(12_000)).toBe('12s');
  });

  it('rounds up, so a run still ahead never reads as zero', () => {
    expect(timeLeftLabel(1)).toBe('1s');
    expect(timeLeftLabel(59_001)).toBe('1m 0s');
  });
});
