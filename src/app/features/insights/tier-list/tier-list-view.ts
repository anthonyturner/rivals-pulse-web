import type { HeroStats, HeroStatsHalfSeason, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import type { TierName } from '../../../../contracts/tier-list.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { seasonView, type SeasonView } from '../half-season-view';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';
import { heroProgressRows, type HeroProgressRow } from '../hero-progress-list/hero-progress';

/** Best first. The page always draws all six, so a tier with no hero is an empty row, not a missing one. */
export const TIER_NAMES: readonly TierName[] = ['S', 'A', 'B', 'C', 'D', 'F'];

export interface TierHeroView extends HeroCellView {
  winRateLabel: string;
  pickRateLabel: string;
  appearancesLabel: string;
}

export interface TierRowView {
  name: TierName;
  heroes: TierHeroView[];
}

export interface SeasonOption {
  id: number;
  label: string;
}

/**
 * - `ready`: at least one hero has reached the minimum, so tier rows are drawn.
 * - `building`: matches are counted, but no hero has reached the minimum yet.
 * - `empty`: nothing is counted for the half-season shown.
 */
export type TierListState = 'ready' | 'building' | 'empty';

export interface TierListView {
  state: TierListState;
  /** The half-season the numbers come from; null before any half-season exists. */
  season: SeasonView | null;
  /** Set when the numbers are the previous half-season's, shown until the current one has enough data. */
  fallbackNotice: string | null;
  minimumMatches: number;
  matchesCountedLabel: string;
  /** All six tiers when `ready`; none otherwise. */
  tiers: TierRowView[];
  /** Heroes short of the minimum, drawn in the same place whether or not other heroes are placed. */
  building: HeroProgressRow[];
}

/** Every half-season the API can answer for, newest first. */
export function seasonOptions(halfSeasons: readonly HeroStatsHalfSeason[]): SeasonOption[] {
  return [...halfSeasons].reverse().map(({ id, label }) => ({ id, label }));
}

/**
 * Turns the hero stats into what the tier list page draws. Every label is built here, so a template
 * never formats a number and a missing figure can never reach the screen as NaN.
 */
export function buildTierListView(stats: HeroStats, identities: HeroIdentities): TierListView {
  const season = stats.halfSeason === null ? null : seasonView(stats.halfSeason);
  const rows = TIER_NAMES.map(
    (name): TierRowView => ({
      name,
      heroes: stats.tiers
        .filter((tier) => tier.name === name)
        .flatMap((tier) => tier.heroes)
        .filter(isReadable)
        .map((hero) => tierHero(hero, identities)),
    }),
  );
  const placed = rows.some((row) => row.heroes.length > 0);
  const building = heroProgressRows(stats.belowMinimum, stats.minimumMatches, identities);

  return {
    state: placed ? 'ready' : building.length > 0 || stats.matchesCounted > 0 ? 'building' : 'empty',
    season,
    fallbackNotice:
      stats.inPlaceOf === null ? null : halfSeasonFallbackNotice(stats.inPlaceOf.label, season?.label ?? null),
    minimumMatches: stats.minimumMatches,
    matchesCountedLabel: countLabel(stats.matchesCounted, 'match', 'matches'),
    tiers: placed ? rows : [],
    building,
  };
}

function tierHero(hero: HeroStatsHero, identities: HeroIdentities): TierHeroView {
  return {
    ...heroCell(hero.hero, identities),
    winRateLabel: percentLabel(hero.winRate),
    pickRateLabel: percentLabel(hero.pickRate),
    appearancesLabel: String(hero.appearances),
  };
}

/** A line whose figures are not finite is left out: "NaN%" is never printed. */
function isReadable(hero: HeroStatsHero): boolean {
  return (
    hero.appearances > 0 &&
    Number.isFinite(hero.appearances) &&
    Number.isFinite(hero.winRate) &&
    Number.isFinite(hero.pickRate)
  );
}
