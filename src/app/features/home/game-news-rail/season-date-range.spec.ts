import { seasonDateRange } from './season-date-range';

const half = (startsAt: string | null, endsAt: string | null) => ({ id: 10.5, label: 'Season 10.5', startsAt, endsAt });

describe('seasonDateRange', () => {
  it('ends the latest half-season with "ongoing"', () => {
    expect(seasonDateRange(half('2026-10-09T09:00:00Z', null))).toBe('October 9, 2026 – ongoing');
  });

  it('ends a finished half-season on the next half-season start', () => {
    expect(seasonDateRange(half('2026-09-11T09:00:00Z', '2026-10-09T09:00:00Z'))).toBe(
      'September 11 – October 9, 2026',
    );
  });

  it('names both years when a half-season spans New Year', () => {
    expect(seasonDateRange(half('2026-12-12T09:00:00Z', '2027-01-16T09:00:00Z'))).toBe(
      'December 12, 2026 – January 16, 2027',
    );
  });

  it('shows no date, not a wrong one, when no start date is known', () => {
    expect(seasonDateRange(undefined)).toBe('');
    expect(seasonDateRange(half(null, null))).toBe('');
    expect(seasonDateRange(half('not a date', null))).toBe('');
  });
});
