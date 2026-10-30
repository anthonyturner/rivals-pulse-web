import {
  HERO_ROLES,
  type HeroRole,
  type RoleStats,
  type RoleStatsMode,
  type RoleStatsModeId,
  type RoleStatsRole,
} from './contracts/role-stats.model.js';
import { buildHalfSeasonTimeline, chooseHalfSeason } from './half-season.js';
import { PLAY_MODE_IDS, killDeathAssistRatio, type HeroAggregateRow, type HeroStatsSource } from './hero-stats.js';

/**
 * Every role number on the Community Stats tab is derived here, from the same per-hero counts the
 * hero numbers use (`hero_aggregates`, through `read_hero_stats()`). A role is the sum of its heroes,
 * so a figure is a pooled average over scoreboard lines, never an average of per-player averages.
 */

/**
 * Lines a role needs in a mode, and lines each figure needs behind it, before it is shown.
 * Fifty lines is about a dozen matches (each side fields two heroes of a role), enough that one
 * unusual match cannot move an average by much.
 */
export const ROLE_STATS_MIN_LINES = 50;

/**
 * Which `participants.play_mode_id` values each mode takes. Unknown (-1), Arcade and Practice are in
 * none of them, for the reason `BLENDED_PLAY_MODE_IDS` gives for the hero numbers.
 */
const MODES: readonly { id: RoleStatsModeId; label: string; playModeIds: readonly number[] }[] = [
  { id: 'all', label: 'Quick Match and Competitive', playModeIds: [PLAY_MODE_IDS.quickMatch, PLAY_MODE_IDS.competitive] },
  { id: 'quick-match', label: 'Quick Match', playModeIds: [PLAY_MODE_IDS.quickMatch] },
  { id: 'competitive', label: 'Competitive', playModeIds: [PLAY_MODE_IDS.competitive] },
];

export interface DeriveRoleStatsOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
  /** Game hero id to the hero's role. A game id missing here is left out of the numbers. */
  roleByGameId: ReadonlyMap<number, HeroRole>;
}

export interface RoleStatsDerivation {
  stats: RoleStats;
  /** Game hero ids in the counted rows that map to no role (for example 0, "no hero recorded"). */
  excludedGameIds: number[];
}

interface Tally {
  appearances: number;
  wins: number;
  killsSum: number;
  killsN: number;
  deathsSum: number;
  deathsN: number;
  assistsSum: number;
  assistsN: number;
  finalHitsSum: number;
  finalHitsN: number;
}

export function deriveRoleStats(source: HeroStatsSource, options: DeriveRoleStatsOptions): RoleStatsDerivation {
  const timeline = buildHalfSeasonTimeline(
    source.halfSeasons,
    source.heroes.map((row) => row.halfSeason),
    options.now,
  );
  const excludedGameIds = new Set<number>();
  const modesOf = (halfSeason: number): RoleStatsMode[] => {
    const rows = source.heroes.filter((row) => row.halfSeason === halfSeason);
    rows.filter((row) => !options.roleByGameId.has(row.gameHeroId)).forEach((row) => excludedGameIds.add(row.gameHeroId));

    return MODES.map((mode) => ({
      id: mode.id,
      label: mode.label,
      roles: HERO_ROLES.map((role) =>
        roleLine(
          role,
          tallyOf(rows.filter((row) => mode.playModeIds.includes(row.playModeId) && options.roleByGameId.get(row.gameHeroId) === role)),
        ),
      ),
    }));
  };
  // The blend holds every line any single mode holds, so it has a ready role whenever one does.
  const isReady = (halfSeason: number): boolean =>
    modesOf(halfSeason)[0].roles.some((entry) => entry.status === 'ready');

  const { shown, inPlaceOf } = chooseHalfSeason(timeline, options.halfSeason, isReady);
  const modes = shown === undefined ? emptyModes() : modesOf(shown);

  return {
    stats: {
      status: modes.some((mode) => mode.roles.some((entry) => entry.status === 'ready')) ? 'ready' : 'not-enough-data',
      minimumLines: ROLE_STATS_MIN_LINES,
      halfSeasons: timeline.started.map(timeline.describe),
      halfSeason: shown === undefined ? null : timeline.describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
      modes,
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  };
}

function tallyOf(rows: readonly HeroAggregateRow[]): Tally {
  const tally: Tally = {
    appearances: 0,
    wins: 0,
    killsSum: 0,
    killsN: 0,
    deathsSum: 0,
    deathsN: 0,
    assistsSum: 0,
    assistsN: 0,
    finalHitsSum: 0,
    finalHitsN: 0,
  };

  for (const row of rows) {
    tally.appearances += row.decidedLines;
    tally.wins += row.wins;
    tally.killsSum += row.killsSum;
    tally.killsN += row.killsN;
    tally.deathsSum += row.deathsSum;
    tally.deathsN += row.deathsN;
    tally.assistsSum += row.assistsSum;
    tally.assistsN += row.assistsN;
    tally.finalHitsSum += row.finalHitsSum;
    tally.finalHitsN += row.finalHitsN;
  }

  return tally;
}

// Built field by field, so a field added to the rows can never reach the public response without
// being named here.
function roleLine(role: HeroRole, tally: Tally): RoleStatsRole {
  const ready = tally.appearances >= ROLE_STATS_MIN_LINES;
  const average = (sum: number, n: number): number | null => (ready && n >= ROLE_STATS_MIN_LINES ? sum / n : null);
  const hasKda =
    ready && [tally.killsN, tally.deathsN, tally.assistsN].every((n) => n >= ROLE_STATS_MIN_LINES);

  return {
    role,
    appearances: tally.appearances,
    status: ready ? 'ready' : 'not-enough-data',
    winRate: ready ? (tally.wins / tally.appearances) * 100 : null,
    killsAverage: average(tally.killsSum, tally.killsN),
    deathsAverage: average(tally.deathsSum, tally.deathsN),
    assistsAverage: average(tally.assistsSum, tally.assistsN),
    kda: hasKda ? killDeathAssistRatio(tally.killsSum, tally.deathsSum, tally.assistsSum) : null,
    finalHitsAverage: average(tally.finalHitsSum, tally.finalHitsN),
  };
}

function emptyModes(): RoleStatsMode[] {
  return MODES.map((mode) => ({
    id: mode.id,
    label: mode.label,
    roles: HERO_ROLES.map((role) => roleLine(role, tallyOf([]))),
  }));
}
