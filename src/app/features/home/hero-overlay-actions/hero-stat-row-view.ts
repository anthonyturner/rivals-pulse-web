import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import type { OverwolfListingStats } from '../../../shared/overwolf-app';
import { matchesCountedLabel } from '../../../shared/utilities/stat-labels';

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
 * The matches figure is the community's one "matches counted" figure for the half-season it names.
 */
export function buildHeroStatRow(listing: OverwolfListingStats, matches: CommunityMatches | null): HeroStatView[] {
  const row: HeroStatView[] = [
    listingStat('downloads', 'Downloads', listing.downloads, (downloads) => downloads.toLocaleString('en-US')),
    listingStat('rating', 'Rating on Overwolf', listing.rating, (rating) => `${rating.toFixed(1)} / 5`),
  ];

  if (matches !== null && matches.matchesCounted !== null && matches.halfSeason !== null && isPositive(matches.matchesCounted)) {
    row.push({
      id: 'matches',
      value: matches.matchesCounted.toLocaleString('en-US'),
      label: matchesCountedLabel(matches.matchesCounted, matches.halfSeason.label),
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
