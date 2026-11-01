import type { HeroStatsHalfSeason } from '../../../../contracts/hero-stats.model';

const monthDay: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', timeZone: 'UTC' };
const monthDayYear: Intl.DateTimeFormatOptions = { ...monthDay, year: 'numeric' };

/**
 * "October 22 – November 12, 2026" for a finished half-season, "October 22, 2026 – ongoing" for the
 * latest one, and an empty string when no start date is known (so the glance shows no date, not a
 * wrong one). The end is the next half-season's start, as the API reports it.
 */
export function seasonDateRange(halfSeason: HeroStatsHalfSeason | undefined): string {
  const start = dateOf(halfSeason?.startsAt);

  if (start === null) {
    return '';
  }

  const end = dateOf(halfSeason?.endsAt);

  if (end === null) {
    return `${format(start, monthDayYear)} – ongoing`;
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();

  return `${format(start, sameYear ? monthDay : monthDayYear)} – ${format(end, monthDayYear)}`;
}

function dateOf(value: string | null | undefined): Date | null {
  const time = value === null || value === undefined ? Number.NaN : Date.parse(value);

  return Number.isNaN(time) ? null : new Date(time);
}

function format(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-US', options).format(date);
}
