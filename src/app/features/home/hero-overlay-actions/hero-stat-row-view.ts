import type { HeroStats } from '../../../../contracts/hero-stats.model';
import type { OverwolfListingStats } from '../../../shared/overwolf-app';

export interface HeroStatView {
  id: 'downloads' | 'rating' | 'matches';
  /** The figure, or "Coming soon" while there is none to state. */
  value: string;
  label: string;
  pending: boolean;
}

const COMING_SOON = 'Coming soon';

/**
 * The figures under the hero buttons: the listing's downloads and rating, then the matches counted.
 * A figure that is missing or not above zero reads "Coming soon", so no "0" reaches the page; the
 * matches figure is left out instead, because the stats being unreadable is not news to announce.
 */
export function buildHeroStatRow(listing: OverwolfListingStats, stats: HeroStats | null): HeroStatView[] {
  const row: HeroStatView[] = [
    listingStat('downloads', 'Downloads', listing.downloads, (downloads) => downloads.toLocaleString('en-US')),
    listingStat('rating', 'Rating on Overwolf', listing.rating, (rating) => `${rating.toFixed(1)} / 5`),
  ];

  if (stats !== null && isPositive(stats.matchesCounted)) {
    const season = stats.halfSeason?.label;

    row.push({
      id: 'matches',
      value: stats.matchesCounted.toLocaleString('en-US'),
      label: `${stats.matchesCounted === 1 ? 'Match' : 'Matches'} counted${season ? ` · ${season}` : ''}`,
      pending: false,
    });
  }

  return row;
}

function listingStat(
  id: HeroStatView['id'],
  label: string,
  figure: number | null,
  format: (figure: number) => string,
): HeroStatView {
  return figure !== null && isPositive(figure)
    ? { id, value: format(figure), label, pending: false }
    : { id, value: COMING_SOON, label, pending: true };
}

function isPositive(figure: number): boolean {
  return Number.isFinite(figure) && figure > 0;
}
