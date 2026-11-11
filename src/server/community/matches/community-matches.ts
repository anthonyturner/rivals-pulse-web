import type {
  CommunityDayCount,
  CommunityMapRecord,
  CommunityMatches,
  CommunityMatchesMinimums,
  CommunityModeShare,
} from '../../../contracts/community-matches.model.ts';
import type { GameCounts } from '../../../contracts/game-counts.model.ts';
import { PLAY_MODE_NAMES } from '../../../contracts/play-modes.ts';
import {
  BLENDED_PLAY_MODE_IDS,
  PLAY_MODE_IDS,
  chooseHalfSeason,
  halfSeasonTimeline,
  type HalfSeasonStart,
} from '../../heroes/stats/hero-stats.ts';
import { matchesCountedIn } from '../../game-counts/matches-counted.ts';
import { estimateWinRatePriors } from '../../heroes/stats/win-rate-prior.ts';

/**
 * Every figure on the Community Matches tab is derived here and nowhere else, from the counts in
 * the `community_*_aggregates` tables. A rate is never stored, and a count that is too small to mean
 * anything is dropped here rather than shown.
 */

/**
 * Almost every upload comes from one player, so these are low on purpose: a figure shows as soon as
 * a little data backs it, and steadies as more matches arrive. The database hides a map, mode or day
 * under 10 matches, so every count here is already a count of shown buckets.
 */
export const COMMUNITY_MATCHES_MINIMUMS: CommunityMatchesMinimums = {
  overviewMatches: 10,
  mapMatches: 10,
  lengthMatches: 10,
};

/** One game mode in one half-season, as `read_community_matches()` returns it. */
export interface CommunityModeRow {
  halfSeason: number;
  playModeId: number;
  matches: number;
  durationSumSeconds: number;
  /** The matches that carried a length; the sum covers only these. */
  durationN: number;
}

/** One map in one game mode and half-season. */
export interface CommunityMapRow {
  halfSeason: number;
  playModeId: number;
  mapName: string;
  matches: number;
  /** Matches whose result from the recorder's side is known. */
  decidedMatches: number;
  wins: number;
}

export interface CommunityDayRow {
  halfSeason: number;
  /** A UTC calendar day, `YYYY-MM-DD`. */
  day: string;
  matches: number;
}

export interface CommunityMatchesSource {
  halfSeasons: readonly HalfSeasonStart[];
  modes: readonly CommunityModeRow[];
  maps: readonly CommunityMapRow[];
  days: readonly CommunityDayRow[];
}

interface DeriveCommunityMatchesOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
  /**
   * The game counts the "matches counted" figure comes from; the figure is null without them. It is
   * not summed from the shown buckets here, so a map, mode or day hidden for being thin cannot
   * make it disagree with Game Stats.
   */
  counts?: GameCounts | null;
  /**
   * Maps the site knows by name. A known map with no shown figure is listed in `mapsBelowMinimum`
   * even when the database sent nothing for it, and a map the game spells in other letters (the
   * database holds "Birnin t'challa") is shown under the known spelling.
   */
  knownMaps?: readonly string[];
}

/** A mode the game reports under an id this site does not know yet is shown as "Other". */
export function playModeName(playModeId: number): string {
  return PLAY_MODE_NAMES.get(playModeId) ?? 'Other';
}

/** What one half-season works out to. */
interface Snapshot {
  maps: CommunityMapRecord[];
  mapsBelowMinimum: string[];
  modeMix: CommunityModeShare[] | null;
  averageLengthMinutes: number | null;
  perDay: CommunityDayCount[] | null;
}

export function deriveCommunityMatches(
  source: CommunityMatchesSource,
  options: DeriveCommunityMatchesOptions,
): CommunityMatches {
  const timeline = halfSeasonTimeline(
    source.halfSeasons,
    source.modes.map((row) => row.halfSeason),
    options.now,
  );
  const { started, describe } = timeline;
  const knownMaps = options.knownMaps ?? [];

  // Built field by field, so a field added to a snapshot can never reach the public response
  // without being named here.
  const toResult = (shown: number | undefined, inPlaceOf: number | undefined): CommunityMatches => {
    const snapshot = shown === undefined ? emptySnapshot() : snapshotOf(source, shown, knownMaps);

    return {
      status: hasFigures(snapshot) ? 'ready' : 'not-enough-data',
      minimums: { ...COMMUNITY_MATCHES_MINIMUMS },
      halfSeasons: started.map(describe),
      halfSeason: shown === undefined ? null : describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : describe(inPlaceOf),
      matchesCounted: shown === undefined || !options.counts ? null : matchesCountedIn(options.counts, shown),
      maps: snapshot.maps,
      mapsBelowMinimum: snapshot.mapsBelowMinimum,
      modeMix: snapshot.modeMix,
      averageLengthMinutes: snapshot.averageLengthMinutes,
      perDay: snapshot.perDay,
    };
  };

  const { shown, inPlaceOf } = chooseHalfSeason(timeline, options.halfSeason, (id) => hasEnoughMatches(source, id));

  return toResult(shown, inPlaceOf);
}

function snapshotOf(source: CommunityMatchesSource, halfSeason: number, knownMaps: readonly string[]): Snapshot {
  const modes = source.modes.filter((row) => row.halfSeason === halfSeason);
  const { maps, mapsBelowMinimum } = mapRecords(
    source.maps.filter((row) => row.halfSeason === halfSeason),
    knownMaps,
  );

  return {
    maps,
    mapsBelowMinimum,
    modeMix: modeMix(modes.filter((row) => row.playModeId !== PLAY_MODE_IDS.unknown)),
    averageLengthMinutes: averageLengthMinutes(
      sum(modes.map((row) => row.durationSumSeconds)),
      sum(modes.map((row) => row.durationN)),
    ),
    perDay: perDay(source.days.filter((row) => row.halfSeason === halfSeason)),
  };
}

/** The days the database let through, as shares of those days, once they add up to a sample worth showing. */
function perDay(days: readonly CommunityDayRow[]): CommunityDayCount[] | null {
  const total = sum(days.map((row) => row.matches));

  if (total < COMMUNITY_MATCHES_MINIMUMS.overviewMatches) {
    return null;
  }

  return days
    .filter((row) => row.matches > 0)
    .map((row): CommunityDayCount => ({ day: row.day, share: wholePercent(row.matches, total) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/** The mean over the matches that carried a length, to the minute; a match without one is not a zero-second match. */
function averageLengthMinutes(totalSeconds: number, withLength: number): number | null {
  return withLength >= COMMUNITY_MATCHES_MINIMUMS.lengthMatches
    ? Math.max(1, Math.round(totalSeconds / withLength / 60))
    : null;
}

function modeMix(modes: readonly CommunityModeRow[]): CommunityModeShare[] | null {
  const total = sum(modes.map((row) => row.matches));

  if (total < COMMUNITY_MATCHES_MINIMUMS.overviewMatches) {
    return null;
  }

  return modes
    .filter((row) => row.matches > 0)
    .sort((a, b) => b.matches - a.matches || a.playModeId - b.playModeId)
    .map(
      (row): CommunityModeShare => ({
        playModeId: row.playModeId,
        mode: playModeName(row.playModeId),
        share: wholePercent(row.matches, total),
        averageLengthMinutes: averageLengthMinutes(row.durationSumSeconds, row.durationN),
      }),
    );
}

/**
 * Win rate per map over the blended modes, from the recorder's side, one result per match. A map
 * needs `mapMatches` decided matches before it shows, and its rate is then pulled toward the maps'
 * average as if some more matches had been played at that average, so a short run of wins does not
 * put a map on top. The pull is estimated from the maps that show, so a figure never depends on a
 * map that does not. `mapsBelowMinimum` names every known map with no figure, never a count.
 */
function mapRecords(
  rows: readonly CommunityMapRow[],
  knownMaps: readonly string[],
): { maps: CommunityMapRecord[]; mapsBelowMinimum: string[] } {
  const knownByKey = new Map(knownMaps.map((name) => [mapNameKey(name), name]));
  const tallies = new Map<string, { name: string; matches: number; wins: number }>();

  for (const row of rows.filter((candidate) => BLENDED_PLAY_MODE_IDS.includes(candidate.playModeId))) {
    const key = mapNameKey(row.mapName);
    const tally = tallies.get(key) ?? { name: knownByKey.get(key) ?? row.mapName.trim(), matches: 0, wins: 0 };
    tally.matches += row.decidedMatches;
    tally.wins += row.wins;
    tallies.set(key, tally);
  }

  const decided = [...tallies.values()].filter(({ matches }) => matches > 0);
  const shown = decided.filter(({ matches }) => matches >= COMMUNITY_MATCHES_MINIMUMS.mapMatches);
  const priors = estimateWinRatePriors(shown);
  const shownNames = new Set(shown.map(({ name }) => name));
  const waiting = new Set([...knownByKey.values(), ...decided.map(({ name }) => name)]);

  // Ordered by what is shown, never by how many matches a map has.
  return {
    maps: shown
      .map((tally): CommunityMapRecord => ({ map: tally.name, winRate: Math.round(priors.estimate(tally).rate * 100) }))
      .sort((a, b) => b.winRate - a.winRate || a.map.localeCompare(b.map)),
    mapsBelowMinimum: [...waiting].filter((name) => !shownNames.has(name)).sort((a, b) => a.localeCompare(b)),
  };
}

/** A map name with its capital letters and apostrophe style removed: the game and the site's list spell the same map in different letters. */
function mapNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[‘’]/g, "'");
}

/** A share of a total as a whole percentage, never shown as 0 for something that happened. */
function wholePercent(part: number, total: number): number {
  return Math.min(100, Math.max(1, Math.round((part / total) * 100)));
}

function hasEnoughMatches(source: CommunityMatchesSource, halfSeason: number): boolean {
  return (
    sum(source.modes.filter((row) => row.halfSeason === halfSeason).map((row) => row.matches)) >=
    COMMUNITY_MATCHES_MINIMUMS.overviewMatches
  );
}

function hasFigures(snapshot: Snapshot): boolean {
  return (
    snapshot.maps.length > 0 ||
    snapshot.modeMix !== null ||
    snapshot.averageLengthMinutes !== null ||
    snapshot.perDay !== null
  );
}

function emptySnapshot(): Snapshot {
  return { maps: [], mapsBelowMinimum: [], modeMix: null, averageLengthMinutes: null, perDay: null };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
