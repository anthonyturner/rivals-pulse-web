import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { modeCaveat, modeLabelOf, nonDefaultModeLabel, scopeLabel } from '../../../shared/utilities/play-modes';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { seasonView, type SeasonView } from '../half-season-view';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';
import { heroProgressRows, type HeroProgressRow } from '../hero-progress-list/hero-progress';

export interface WinRateRowView extends HeroCellView {
  winRate: number;
  winRateLabel: string;
  /** Where the bar's fill ends, as a share of its width. */
  barPercent: number;
  tone: 'above' | 'even' | 'below';
  appearances: number;
  appearancesLabel: string;
  winsLabel: string;
}

/**
 * - `full`: at least one hero has reached the minimum.
 * - `partial`: matches are counted, but no hero has reached the minimum yet.
 * - `empty`: nothing is counted for the half-season shown.
 * - `unavailable-season`: the address names a half-season the site holds no numbers for.
 */
export type WinRatesState = 'full' | 'partial' | 'empty' | 'unavailable-season';

export interface WinRatesView {
  state: WinRatesState;
  /** The half-season the numbers come from; null before any half-season exists. */
  season: SeasonView | null;
  /** Set when the address names a half-season that is not the one shown. */
  requestedLabel: string | null;
  /** The mode the numbers count, such as "Competitive" or "Quick Match and Competitive". */
  modeLabel: string;
  /** Set for a mode whose numbers do not mean what Quick Match and Competitive do. */
  modeCaveat: string | null;
  /** Set when the numbers are the previous half-season's, shown until the current one has enough data. */
  fallbackNotice: string | null;
  minimumMatches: number;
  matchesCountedLabel: string;
  /** "in Competitive for Season 10.5": names the mode and half-season that a count or an empty state is about. */
  scopeLabel: string;
  ranked: WinRateRowView[];
  building: HeroProgressRow[];
}

/**
 * Turns the hero stats into what the win-rate page draws. Every label is built here, so a template
 * never formats a number and a missing figure can never reach the screen as NaN.
 *
 * `requestedSeason` is the address's season segment. The API serves one half-season, so any other
 * season gets the `unavailable-season` state, never an error; a segment that is not a half-season
 * number (such as `10` or `10.5`) is ignored and the served half-season is shown.
 */
export function buildWinRatesView(
  stats: HeroStats,
  requestedSeason: string | null,
  identities: HeroIdentities,
): WinRatesView {
  const season = stats.halfSeason === null ? null : seasonView(stats.halfSeason);
  const requested = parseSeason(requestedSeason);
  const shown = stats.halfSeason?.id;
  const servedIds = [stats.halfSeason?.id, stats.inPlaceOf?.id];
  const modeLabel = modeLabelOf(stats);
  const base = {
    season,
    requestedLabel: null,
    modeLabel,
    modeCaveat: modeCaveat(stats.mode),
    fallbackNotice: null,
    minimumMatches: stats.minimumMatches,
    matchesCountedLabel: countLabel(stats.matchesCounted, 'match', 'matches'),
    scopeLabel: scopeLabel(modeLabel, season?.label ?? null),
    ranked: [],
    building: [],
  };

  if (shown === undefined) {
    return { ...base, state: 'empty' };
  }

  if (requested !== null && !servedIds.includes(requested)) {
    return { ...base, state: 'unavailable-season', requestedLabel: `Season ${requested}` };
  }

  const ranked = stats.tiers
    .flatMap((tier) => tier.heroes)
    .filter(
      (hero) => hero.appearances > 0 && Number.isFinite(hero.winRate) && Number.isFinite(hero.wins),
    )
    .map((hero) => rankedRow(hero, identities))
    .sort(
      (a, b) =>
        b.winRate - a.winRate || b.appearances - a.appearances || a.name.localeCompare(b.name),
    );
  const building = heroProgressRows(stats.belowMinimum, stats.minimumMatches, identities);
  const fallbackNotice =
    stats.inPlaceOf === null
      ? null
      : halfSeasonFallbackNotice(stats.inPlaceOf.label, season?.label ?? null, nonDefaultModeLabel(stats));
  const state: WinRatesState =
    ranked.length > 0 ? 'full' : building.length > 0 || stats.matchesCounted > 0 ? 'partial' : 'empty';

  return { ...base, state, fallbackNotice, ranked, building };
}

function rankedRow(
  hero: HeroStats['tiers'][number]['heroes'][number],
  identities: HeroIdentities,
): WinRateRowView {
  return {
    ...heroCell(hero.hero, identities),
    winRate: hero.winRate,
    winRateLabel: percentLabel(hero.winRate),
    barPercent: Math.min(100, Math.max(0, hero.winRate)),
    tone: hero.winRate > 50 ? 'above' : hero.winRate < 50 ? 'below' : 'even',
    appearances: hero.appearances,
    appearancesLabel: String(hero.appearances),
    winsLabel: countLabel(hero.wins, 'win', 'wins'),
  };
}

/** A half-season id is a positive whole or half number such as 10 or 10.5; anything else is ignored. */
function parseSeason(value: string | null): number | null {
  return value !== null && /^(?:[1-9]\d*(?:\.5)?|0\.5)$/.test(value) ? Number(value) : null;
}
