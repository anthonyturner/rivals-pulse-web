import type { HeroStats, HeroStatsHalfSeason } from '../../../../contracts/hero-stats.model';
import { countLabel, halfSeasonFallbackNotice, percentLabel } from '../../../shared/utilities/stat-labels';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';

export interface SeasonView {
  id: number;
  label: string;
  /** "Oct 22, 2026 to Nov 12, 2026", or "Started Oct 22, 2026" while it is the latest; null when no date is known. */
  dateRange: string | null;
}

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

export interface BuildingRowView extends HeroCellView {
  appearances: number;
  progressLabel: string;
  progressPercent: number;
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
  /** Set when the numbers are the previous half-season's, shown until the current one has enough data. */
  fallbackNotice: string | null;
  minimumMatches: number;
  matchesCountedLabel: string;
  ranked: WinRateRowView[];
  building: BuildingRowView[];
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
  const base = {
    season,
    requestedLabel: null,
    fallbackNotice: null,
    minimumMatches: stats.minimumMatches,
    matchesCountedLabel: countLabel(stats.matchesCounted, 'match', 'matches'),
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
  const building = stats.belowMinimum
    .filter((hero) => hero.appearances > 0)
    .map((hero) => buildingRow(hero.hero, hero.appearances, stats.minimumMatches, identities))
    .sort((a, b) => b.appearances - a.appearances || a.name.localeCompare(b.name));
  const fallbackNotice =
    stats.inPlaceOf === null
      ? null
      : halfSeasonFallbackNotice(stats.inPlaceOf.label, season?.label ?? null);
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

function buildingRow(
  hero: string,
  appearances: number,
  minimum: number,
  identities: HeroIdentities,
): BuildingRowView {
  return {
    ...heroCell(hero, identities),
    appearances,
    progressLabel: `${appearances} of ${minimum}`,
    progressPercent: minimum > 0 ? Math.min(100, (appearances / minimum) * 100) : 0,
  };
}

function seasonView(halfSeason: HeroStatsHalfSeason): SeasonView {
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

/** A half-season id is a positive whole or half number such as 10 or 10.5; anything else is ignored. */
function parseSeason(value: string | null): number | null {
  return value !== null && /^(?:[1-9]\d*(?:\.5)?|0\.5)$/.test(value) ? Number(value) : null;
}
