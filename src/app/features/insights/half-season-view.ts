import type { HeroStatsHalfSeason } from '../../../contracts/hero-stats.model';

export interface SeasonView {
  id: number;
  label: string;
  /** "Oct 22, 2026 to Nov 12, 2026", or "Started Oct 22, 2026" while it is the latest; null when no date is known. */
  dateRange: string | null;
}

export function seasonView(halfSeason: HeroStatsHalfSeason): SeasonView {
  const start = dateLabel(halfSeason.startsAt);
  const end = dateLabel(halfSeason.endsAt);

  return {
    id: halfSeason.id,
    label: halfSeason.label,
    dateRange: start === null ? null : end === null ? `Started ${start}` : `${start} to ${end}`,
  };
}

function dateLabel(value: string | null): string | null {
  const time = value === null ? Number.NaN : Date.parse(value);

  return Number.isNaN(time)
    ? null
    : new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' }).format(time);
}
