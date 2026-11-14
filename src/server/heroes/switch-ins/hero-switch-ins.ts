import type { HeroStatsHalfSeason } from '../../../contracts/hero-stats.model.ts';
import type { HeroSwitchIn, HeroSwitchIns, HeroSwitchInOverall } from '../../../contracts/hero-switch-ins.model.ts';
import { snapshotOf as matchupsOf, type HeroMatchupRow } from '../matchups/hero-matchups.ts';
import { BLENDED_PLAY_MODE_IDS, chooseHalfSeason, halfSeasonTimeline, type HalfSeasonStart } from '../stats/hero-stats.ts';

/**
 * Every switch-in number on the site is derived here, from the counts in `hero_switch_ins` as
 * `read_hero_switch_ins()` returns them, set beside the hero's overall record from `hero_matchups`.
 * It describes a record; it does not say what to switch to.
 */

/**
 * Matches a pairing needs before it is shown. Mirrors `hero_figure_qualifies` in the database, which
 * is where the rule is applied, per half-season and mode before any modes are summed: a pairing under
 * it never reaches this code. A test compares the two.
 */
export const SWITCH_IN_MIN_MATCHES = 10;

/** Different players who must have recorded those matches. Mirrors `hero_figure_qualifies` as well. */
export const SWITCH_IN_MIN_PLAYERS = 2;

/** The modes the counts blend: the same Quick Match and Competitive blend as the hero stats. */
export const SWITCH_IN_PLAY_MODE_IDS: readonly number[] = BLENDED_PLAY_MODE_IDS;

/** One hero switched to, against one enemy hero, in one half-season, summed over the modes asked for. */
export interface HeroSwitchInRow {
  halfSeason: number;
  /** The game's hero id, not the site's slug. */
  gameHeroId: number;
  enemyGameHeroId: number;
  /** Matches with a switch whose team won or lost. */
  decidedMatches: number;
  /** Switches (one per enemy hero on the field) whose team won or lost: what `wins` and the rate are counted over. */
  decidedSwitches: number;
  wins: number;
}

interface DeriveHeroSwitchInsOptions {
  now: Date;
  /** Game hero id to the hero's id in `heroes.json`. A game id missing here is left out. */
  heroSlugByGameId: ReadonlyMap<number, string>;
}

interface HeroSwitchInsDerivation {
  switchIns: HeroSwitchIns;
  /** Game hero ids in the rows that map to no hero (for example 0, "no hero recorded"). */
  excludedGameIds: number[];
}

interface Tally {
  matches: number;
  switches: number;
  wins: number;
}

interface HalfSeasonSnapshot {
  switchIns: HeroSwitchIn[];
  excludedGameIds: Set<number>;
}

export function deriveHeroSwitchIns(
  rows: readonly HeroSwitchInRow[],
  matchupRows: readonly HeroMatchupRow[],
  halfSeasons: readonly HalfSeasonStart[],
  options: DeriveHeroSwitchInsOptions,
): HeroSwitchInsDerivation {
  const timeline = halfSeasonTimeline(
    halfSeasons,
    rows.map((row) => row.halfSeason),
    options.now,
  );
  const excludedGameIds = new Set<number>();
  const snapshots = new Map<number, HalfSeasonSnapshot>();
  const snapshot = (id: number): HalfSeasonSnapshot => {
    let result = snapshots.get(id);

    if (result === undefined) {
      result = snapshotOf(rows, matchupRows, id, options.heroSlugByGameId);
      result.excludedGameIds.forEach((gameId) => excludedGameIds.add(gameId));
      snapshots.set(id, result);
    }

    return result;
  };
  const { shown, inPlaceOf } = chooseHalfSeason(timeline, undefined, (id) => snapshot(id).switchIns.length > 0);
  const switchIns = shown === undefined ? [] : snapshot(shown).switchIns;
  const describe = (id: number | undefined): HeroStatsHalfSeason | null => (id === undefined ? null : timeline.describe(id));

  return {
    switchIns: {
      status: switchIns.length > 0 ? 'ready' : 'not-enough-data',
      minimumMatches: SWITCH_IN_MIN_MATCHES,
      minimumPlayers: SWITCH_IN_MIN_PLAYERS,
      halfSeason: describe(shown),
      inPlaceOf: describe(inPlaceOf),
      switchIns,
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  };
}

function snapshotOf(
  rows: readonly HeroSwitchInRow[],
  matchupRows: readonly HeroMatchupRow[],
  halfSeason: number,
  heroSlugByGameId: ReadonlyMap<number, string>,
): HalfSeasonSnapshot {
  const tallies = new Map<string, { hero: string; enemy: string; tally: Tally }>();
  const excludedGameIds = new Set<number>();

  for (const row of rows.filter((candidate) => candidate.halfSeason === halfSeason)) {
    const hero = heroSlugByGameId.get(row.gameHeroId);
    const enemy = heroSlugByGameId.get(row.enemyGameHeroId);

    if (hero === undefined || enemy === undefined) {
      [row.gameHeroId, row.enemyGameHeroId]
        .filter((gameId) => !heroSlugByGameId.has(gameId))
        .forEach((gameId) => excludedGameIds.add(gameId));
      continue;
    }

    // A hero against itself (a mirror, or one Deadpool form against another) says nothing about a counter.
    if (hero === enemy || row.decidedSwitches <= 0) {
      continue;
    }

    const key = `${hero}|${enemy}`;
    const entry = tallies.get(key) ?? { hero, enemy, tally: { matches: 0, switches: 0, wins: 0 } };
    // The database stores a hero under its base game id, so one pairing normally arrives as one row. Rows
    // of several game ids (a role form kept from before that) cannot be told apart by match, and a match
    // can sit in each of them, so the largest never overstates where the sum could. Every switch is
    // its own event on the hero side, so those add.
    entry.tally.matches = Math.max(entry.tally.matches, row.decidedMatches);
    entry.tally.switches += row.decidedSwitches;
    entry.tally.wins += row.wins;
    tallies.set(key, entry);
  }

  const overall = new Map(
    matchupsOf(matchupRows, halfSeason, heroSlugByGameId).matchups.map((matchup) => [
      `${matchup.hero}|${matchup.enemy}`,
      overallOf(matchup),
    ]),
  );

  return {
    switchIns: [...tallies.values()]
      .filter(({ tally }) => tally.matches >= SWITCH_IN_MIN_MATCHES)
      .sort((a, b) => a.hero.localeCompare(b.hero) || a.enemy.localeCompare(b.enemy))
      .map(({ hero, enemy, tally }) => switchInLine(hero, enemy, tally, overall.get(`${hero}|${enemy}`) ?? null)),
    excludedGameIds,
  };
}

// Built field by field, so a field added to the rows can never reach the public response without
// being named here.
function switchInLine(hero: string, enemy: string, tally: Tally, overall: HeroSwitchInOverall | null): HeroSwitchIn {
  return {
    hero,
    enemy,
    matches: tally.matches,
    switches: tally.switches,
    wins: tally.wins,
    winRate: (tally.wins / tally.switches) * 100,
    overall,
  };
}

function overallOf(matchup: { matches: number; appearances: number; wins: number; winRate: number }): HeroSwitchInOverall {
  return {
    matches: matchup.matches,
    appearances: matchup.appearances,
    wins: matchup.wins,
    winRate: matchup.winRate,
  };
}
