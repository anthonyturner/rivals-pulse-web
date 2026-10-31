import type {
  CommunityFigures,
  CommunityFiguresMinimums,
  CommunityFiguresMode,
  CommunityHeroFigures,
  CommunityPerMinute,
  CommunityRoleFigures,
} from './contracts/community-figures.model.js';
import { HERO_ROLES, type HeroRole } from './contracts/role-stats.model.js';
import {
  HERO_STATS_MIN_MATCHES,
  PLAY_MODES,
  chooseHalfSeason,
  halfSeasonTimeline,
  type HalfSeasonStart,
} from './hero-stats.js';
import { ROLE_STATS_MIN_LINES } from './role-stats.js';

/**
 * Every damage, healing and damage-blocked rate on the site is derived here and nowhere else, from
 * the counts in `hero_figure_aggregates` as `read_community_hero_figures()` returns them.
 *
 * Per minute is `sum * 60 / seconds`, where the seconds are those of exactly the lines that carry
 * the figure and the time played. A line from an older app, which carries neither, is in no sum and
 * no `n`, so it is left out rather than counted as 0. A role or a hero is pooled (sums and seconds
 * added, then divided), never an average of rates.
 */

/**
 * Lines that carry a figure before a rate is shown. A role needs as many lines as the Stats tab's
 * other role figures, and a hero as many as the hero numbers: about a dozen matches either way.
 */
export const COMMUNITY_FIGURES_MINIMUMS: CommunityFiguresMinimums = {
  roleLines: ROLE_STATS_MIN_LINES,
  heroLines: HERO_STATS_MIN_MATCHES,
  // Mirrors `community_bucket_shown` in the database, which is where the privacy rule is applied:
  // a hero's figure that fewer players recorded (or that one player mostly recorded) arrives as
  // zero lines, so every sum here is already a sum over shown buckets.
  recorders: 3,
};

/** One hero in one half-season and mode, as `read_community_hero_figures()` returns it. */
export interface HeroFigureRow {
  halfSeason: number;
  playModeId: number;
  /** The game's hero id, not the site's slug. */
  gameHeroId: number;
  /** Each figure's sum, the lines that carry it with a time played, and the seconds of those lines. */
  damageSum: number;
  damageN: number;
  damageSeconds: number;
  healingSum: number;
  healingN: number;
  healingSeconds: number;
  blockedSum: number;
  blockedN: number;
  blockedSeconds: number;
}

export interface CommunityFiguresSource {
  halfSeasons: readonly HalfSeasonStart[];
  figures: readonly HeroFigureRow[];
}

export interface DeriveCommunityFiguresOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
  /** Game hero id to the hero's role. A game id missing here is left out of the role figures. */
  roleByGameId: ReadonlyMap<number, HeroRole>;
  /** Game hero id to the hero's id in `heroes.json`. A game id missing here is left out of the numbers. */
  heroSlugByGameId: ReadonlyMap<number, string>;
}

export interface CommunityFiguresDerivation {
  figures: CommunityFigures;
  /** Game hero ids in the counted rows that map to no hero (for example 0, "no hero recorded"). */
  excludedGameIds: number[];
}

/** Sum over seconds, per minute. No time played is no rate, never infinity or NaN. */
export function perMinute(sum: number, seconds: number): number | null {
  const rate = (sum * 60) / seconds;

  return Number.isFinite(rate) && seconds > 0 ? rate : null;
}

interface FigureTally {
  sum: number;
  n: number;
  seconds: number;
}

type Tallies = Record<keyof CommunityPerMinute, FigureTally>;

function emptyTallies(): Tallies {
  return {
    damage: { sum: 0, n: 0, seconds: 0 },
    healing: { sum: 0, n: 0, seconds: 0 },
    blocked: { sum: 0, n: 0, seconds: 0 },
  };
}

function addRow(tallies: Tallies, row: HeroFigureRow): void {
  const add = (tally: FigureTally, sum: number, n: number, seconds: number): void => {
    tally.sum += sum;
    tally.n += n;
    tally.seconds += seconds;
  };

  add(tallies.damage, row.damageSum, row.damageN, row.damageSeconds);
  add(tallies.healing, row.healingSum, row.healingN, row.healingSeconds);
  add(tallies.blocked, row.blockedSum, row.blockedN, row.blockedSeconds);
}

/** The rounded rate of each figure that has `minimumLines` lines behind it, null for the rest. */
function ratesOf(tallies: Tallies, minimumLines: number): CommunityPerMinute {
  const rate = (tally: FigureTally): number | null => {
    const value = tally.n >= minimumLines ? perMinute(tally.sum, tally.seconds) : null;

    return value === null ? null : Math.round(value);
  };

  return { damage: rate(tallies.damage), healing: rate(tallies.healing), blocked: rate(tallies.blocked) };
}

function hasFigure(rates: CommunityPerMinute): boolean {
  return rates.damage !== null || rates.healing !== null || rates.blocked !== null;
}

export function deriveCommunityFigures(
  source: CommunityFiguresSource,
  options: DeriveCommunityFiguresOptions,
): CommunityFiguresDerivation {
  const timeline = halfSeasonTimeline(
    source.halfSeasons,
    source.figures.map((row) => row.halfSeason),
    options.now,
  );
  const excludedGameIds = new Set<number>();
  const modesFor = (rows: readonly HeroFigureRow[]): CommunityFiguresMode[] =>
    PLAY_MODES.map((mode) => {
      const inMode = rows.filter((row) => mode.playModeIds.includes(row.playModeId));

      return {
        id: mode.id,
        label: mode.label,
        roles: roleFigures(inMode, options.roleByGameId),
        heroes: heroFigures(inMode, options.heroSlugByGameId),
      };
    });
  const modesByHalfSeason = new Map<number, CommunityFiguresMode[]>();
  const modesOf = (halfSeason: number): CommunityFiguresMode[] => {
    const cached = modesByHalfSeason.get(halfSeason);

    if (cached !== undefined) {
      return cached;
    }

    const rows = source.figures.filter((row) => row.halfSeason === halfSeason);
    rows
      .filter((row) => !options.heroSlugByGameId.has(row.gameHeroId))
      .forEach((row) => excludedGameIds.add(row.gameHeroId));

    const modes = modesFor(rows);
    modesByHalfSeason.set(halfSeason, modes);

    return modes;
  };
  const hasFigureIn = (mode: CommunityFiguresMode): boolean =>
    mode.roles.some(hasFigure) || mode.heroes.some(hasFigure);

  // The half-season follows the blend, the default view, so Arcade or Practice lines alone never decide it.
  const { shown, inPlaceOf } = chooseHalfSeason(timeline, options.halfSeason, (id) => hasFigureIn(modesOf(id)[0]));
  const modes = shown === undefined ? modesFor([]) : modesOf(shown);

  return {
    figures: {
      status: modes.some(hasFigureIn) ? 'ready' : 'not-enough-data',
      minimums: { ...COMMUNITY_FIGURES_MINIMUMS },
      halfSeasons: timeline.started.map(timeline.describe),
      halfSeason: shown === undefined ? null : timeline.describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
      modes,
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  };
}

// Built field by field, so a field added to the rows can never reach the public response without
// being named here.
function roleFigures(rows: readonly HeroFigureRow[], roleByGameId: ReadonlyMap<number, HeroRole>): CommunityRoleFigures[] {
  return HERO_ROLES.map((role) => {
    const tallies = emptyTallies();
    rows.filter((row) => roleByGameId.get(row.gameHeroId) === role).forEach((row) => addRow(tallies, row));

    return { role, ...ratesOf(tallies, COMMUNITY_FIGURES_MINIMUMS.roleLines) };
  });
}

function heroFigures(
  rows: readonly HeroFigureRow[],
  heroSlugByGameId: ReadonlyMap<number, string>,
): CommunityHeroFigures[] {
  const byHero = new Map<string, Tallies>();

  for (const row of rows) {
    const hero = heroSlugByGameId.get(row.gameHeroId);

    if (hero !== undefined) {
      const tallies = byHero.get(hero) ?? emptyTallies();
      addRow(tallies, row);
      byHero.set(hero, tallies);
    }
  }

  return [...byHero]
    .map(([hero, tallies]) => ({ hero, ...ratesOf(tallies, COMMUNITY_FIGURES_MINIMUMS.heroLines) }))
    .filter(hasFigure)
    .sort((a, b) => a.hero.localeCompare(b.hero));
}
