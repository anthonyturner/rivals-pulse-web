import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import type { TierName } from '../../../../contracts/tier-list.model';
import { modeCaveat, modeLabelOf, nonDefaultModeLabel, scopeLabel } from '../../../shared/utilities/play-modes';
import {
  countLabel,
  halfSeasonFallbackNotice,
  percentLabel,
  placementRequirementLabel,
} from '../../../shared/utilities/stat-labels';
import { seasonView, type SeasonView } from '../half-season-view';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';
import { heroProgressRows, minimumsOf, type HeroProgressRow } from '../hero-progress-list/hero-progress';

/** Best first. A tier no hero reached is left out of the rows, so these are the tiers a page may draw, not the ones it always does. */
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
  /** The mode the numbers count, such as "Competitive" or "Quick Match and Competitive". */
  modeLabel: string;
  /** Set for a mode whose numbers do not mean what Quick Match and Competitive do. */
  modeCaveat: string | null;
  /** Set when the numbers are the previous half-season's, shown until the current one has enough data. */
  fallbackNotice: string | null;
  minimumMatches: number;
  /** What a hero needs to be placed: "10 appearances and 2 players", or the appearances alone. */
  placementLabel: string;
  matchesCountedLabel: string;
  /** "in Competitive for Season 10.5": names the mode and half-season that a count or an empty state is about. */
  scopeLabel: string;
  /** The tiers that have a hero, best first, when `ready`; none otherwise. */
  tiers: TierRowView[];
  /** Heroes short of a minimum, drawn in the same place whether or not other heroes are placed. */
  building: HeroProgressRow[];
}

/**
 * Turns the hero stats into what the tier list page draws. Every label is built here, so a template
 * never formats a number and a missing figure can never reach the screen as NaN.
 */
export function buildTierListView(stats: HeroStats, identities: HeroIdentities): TierListView {
  const season = stats.halfSeason === null ? null : seasonView(stats.halfSeason);
  const rows = tierRowsOf(stats, TIER_NAMES, identities);
  const placed = rows.length > 0;
  const building = heroProgressRows(stats.belowMinimum, minimumsOf(stats), identities);
  const modeLabel = modeLabelOf(stats);

  return {
    state: placed ? 'ready' : building.length > 0 || stats.matchesCounted > 0 ? 'building' : 'empty',
    season,
    modeLabel,
    modeCaveat: modeCaveat(stats.mode),
    fallbackNotice:
      stats.inPlaceOf === null
        ? null
        : halfSeasonFallbackNotice(stats.inPlaceOf.label, season?.label ?? null, nonDefaultModeLabel(stats)),
    minimumMatches: stats.minimumMatches,
    placementLabel: placementRequirementLabel(stats),
    matchesCountedLabel: countLabel(stats.matchesCounted, 'match', 'matches'),
    scopeLabel: scopeLabel(modeLabel, season?.label ?? null),
    tiers: rows,
    building,
  };
}

/** One row per named tier that has a hero with a readable record, in the order given. A tier with none is left out. */
export function tierRowsOf(
  stats: HeroStats,
  names: readonly TierName[],
  identities: HeroIdentities,
): TierRowView[] {
  return names
    .map((name) => ({
      name,
      heroes: stats.tiers
        .filter((tier) => tier.name === name)
        .flatMap((tier) => tier.heroes)
        .filter(isReadable)
        .map((hero) => tierHero(hero, identities)),
    }))
    .filter((row) => row.heroes.length > 0);
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
    Number.isFinite(hero.pickRate) &&
    Number.isFinite(hero.shrunkWinRate)
  );
}
