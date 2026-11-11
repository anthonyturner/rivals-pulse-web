import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { modeCaveat, modeLabelOf, nonDefaultModeLabel, scopeLabel } from '../../../shared/utilities/play-modes';
import {
  countLabel,
  decidedMatchesLabel,
  halfSeasonFallbackNotice,
  percentLabel,
  placementRequirementLabel,
} from '../../../shared/utilities/stat-labels';
import { seasonView, type SeasonView } from '../half-season-view';
import { heroCell, type HeroCellView, type HeroIdentities } from '../hero-identity';
import { heroProgressRows, minimumsOf, type HeroProgressRow } from '../hero-progress-list/hero-progress';

export interface WinRateRowView extends HeroCellView {
  rank: number;
  winRate: number;
  winRateLabel: string;
  pickRate: number | null;
  pickRateLabel: string;
  /** Where the bar's fill ends, as a share of its width. */
  barPercent: number;
  tone: 'above' | 'even' | 'below';
  appearances: number;
  /** "11 / 14": wins, then games. */
  winsGamesLabel: string;
  /** What a screen reader says for the same cell: "11 wins in 14 games". */
  winsGamesSpoken: string;
}

/**
 * - `full`: at least one hero has reached the minimum.
 * - `partial`: matches are counted, but no hero has reached the minimum yet.
 * - `empty`: nothing is counted for the half-season shown.
 * - `unavailable-season`: the address names a half-season the site holds no numbers for.
 */
export type WinRatesState = 'full' | 'partial' | 'empty' | 'unavailable-season';

export type HeroStatsSort = 'win-desc' | 'win-asc' | 'pick-desc' | 'pick-asc';

export function selectHeroStatsRows(
  rows: readonly WinRateRowView[],
  search: string,
  role: string,
  sort: HeroStatsSort,
): WinRateRowView[] {
  const query = search.trim().toLocaleLowerCase();
  const byPick = sort.startsWith('pick');
  const direction = sort.endsWith('asc') ? 1 : -1;

  return rows
    .filter((row) => (!role || row.role === role) && row.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      const left = byPick ? a.pickRate : a.winRate;
      const right = byPick ? b.pickRate : b.winRate;

      if (left === null || right === null) {
        return left === right ? a.name.localeCompare(b.name) : left === null ? 1 : -1;
      }

      return direction * (left - right) || b.appearances - a.appearances || a.name.localeCompare(b.name);
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

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
  /** "10 appearances", or "1 appearance". */
  minimumLabel: string;
  /** What a hero needs to be listed: "10 appearances and 2 players", or the appearances alone. */
  placementLabel: string;
  decidedMatchesLabel: string;
  /** The toolbar's facts in reading order; empty when there is no table or progress list to describe. */
  metaParts: string[];
  /** "in Competitive for Season 10.5": names the mode and half-season that a count or an empty state is about. */
  scopeLabel: string;
  ranked: WinRateRowView[];
  building: HeroProgressRow[];
}

/**
 * Turns the hero stats into what the win-rate page draws. Every label is built here, so a template
 * never formats a number and a missing figure can never reach the screen as NaN.
 *
 * `requestedSeason` is the address's season segment. This page shows only the half-season the API
 * serves by default, so any other season gets the `unavailable-season` state, never an error; a
 * segment that is not a half-season number (such as `week-2`) is ignored and the served
 * half-season is shown.
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
    minimumLabel: countLabel(stats.minimumMatches, 'appearance', 'appearances'),
    placementLabel: placementRequirementLabel(stats),
    decidedMatchesLabel: decidedMatchesLabel(stats.matchesCounted),
    metaParts: [],
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
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
  const building = heroProgressRows(stats.belowMinimum, minimumsOf(stats), identities);
  const fallbackNotice =
    stats.inPlaceOf === null
      ? null
      : halfSeasonFallbackNotice(stats.inPlaceOf.label, season?.label ?? null, nonDefaultModeLabel(stats));
  const state: WinRatesState =
    ranked.length > 0 ? 'full' : building.length > 0 || stats.matchesCounted > 0 ? 'partial' : 'empty';
  const metaParts =
    state === 'empty'
      ? []
      : [
          season?.label,
          season?.dateRange,
          base.decidedMatchesLabel,
          `Heroes need ${base.placementLabel} to be listed`,
          state === 'full' ? 'Bars show win rate; the line marks 50%.' : null,
        ].filter((part): part is string => !!part);

  return { ...base, state, fallbackNotice, metaParts, ranked, building };
}

function rankedRow(
  hero: HeroStats['tiers'][number]['heroes'][number],
  identities: HeroIdentities,
): Omit<WinRateRowView, 'rank'> {
  const wins = countLabel(hero.wins, 'win', 'wins');
  const games = countLabel(hero.appearances, 'game', 'games');

  return {
    ...heroCell(hero.hero, identities),
    winRate: hero.winRate,
    winRateLabel: percentLabel(hero.winRate),
    pickRate: Number.isFinite(hero.pickRate) && hero.pickRate >= 0 ? hero.pickRate : null,
    pickRateLabel: Number.isFinite(hero.pickRate) && hero.pickRate >= 0 ? percentLabel(hero.pickRate) : 'Not available',
    barPercent: Math.min(100, Math.max(0, hero.winRate)),
    tone: hero.winRate > 50 ? 'above' : hero.winRate < 50 ? 'below' : 'even',
    appearances: hero.appearances,
    winsGamesLabel: `${hero.wins} / ${hero.appearances}`,
    winsGamesSpoken: `${wins} in ${games}`,
  };
}

/** A half-season id is a positive whole or half number such as 10 or 10.5; anything else is ignored. */
function parseSeason(value: string | null): number | null {
  return value !== null && /^(?:[1-9]\d*(?:\.5)?|0\.5)$/.test(value) ? Number(value) : null;
}
