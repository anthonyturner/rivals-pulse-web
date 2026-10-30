import type {
  CommunityDayCount,
  CommunityMapRecord,
  CommunityMatches,
  CommunityMatchesMinimums,
  CommunityModeShare,
} from './contracts/community-matches.model.js';
import {
  BLENDED_PLAY_MODE_IDS,
  PLAY_MODE_IDS,
  halfSeasonTimeline,
  type HalfSeasonStart,
} from './hero-stats.js';

/**
 * Every figure on the Community Matches tab is derived here and nowhere else, from the counts in
 * the `community_*_aggregates` tables. A rate is never stored, and a count that is too small to mean
 * anything is dropped here rather than shown.
 */

/**
 * With one uploader most half-seasons start thin, so these are low on purpose: just enough that one
 * lucky evening does not read as "the community".
 */
export const COMMUNITY_MATCHES_MINIMUMS: CommunityMatchesMinimums = {
  overviewMatches: 20,
  mapMatches: 10,
  lengthMatches: 10,
  // Mirrors `community_bucket_shown` in the database, which is where the privacy rule is applied:
  // a map, mode or day that fewer players recorded (or that one player mostly recorded) never
  // reaches this code, so every count here is already a count of shown buckets.
  recorders: 3,
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

export interface DeriveCommunityMatchesOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
}

const MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [PLAY_MODE_IDS.quickMatch, 'Quick Match'],
  [PLAY_MODE_IDS.competitive, 'Competitive'],
  [PLAY_MODE_IDS.arcade, 'Arcade'],
  [PLAY_MODE_IDS.practice, 'Practice'],
]);

/** A mode the game reports under an id this site does not know yet is shown as "Other". */
export function playModeName(playModeId: number): string {
  return MODE_NAMES.get(playModeId) ?? 'Other';
}

/**
 * The volume bands, as the floor a "100+ matches" label states. An exact total next to shown buckets
 * would let a reader subtract the hidden ones, so only the band leaves this module.
 */
export const MATCH_VOLUME_BANDS: readonly number[] = [20, 50, 100, 250, 500, 1000, 2500, 5000];

/** The largest band the count reaches, or null below the smallest. */
export function matchVolumeBand(matches: number): number | null {
  return [...MATCH_VOLUME_BANDS].reverse().find((band) => matches >= band) ?? null;
}

/** What one half-season works out to. `matchesCounted` is internal: only its band is published. */
interface Snapshot {
  matchesCounted: number;
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
  const { current, started, describe, previousOf } = halfSeasonTimeline(
    source.halfSeasons,
    source.modes.map((row) => row.halfSeason),
    options.now,
  );

  // Built field by field, so a field added to a snapshot can never reach the public response
  // without being named here.
  const toResult = (shown: number | undefined, inPlaceOf: number | undefined): CommunityMatches => {
    const snapshot = shown === undefined ? emptySnapshot() : snapshotOf(source, shown);

    return {
      status: hasFigures(snapshot) ? 'ready' : 'not-enough-data',
      minimums: { ...COMMUNITY_MATCHES_MINIMUMS },
      halfSeasons: started.map(describe),
      halfSeason: shown === undefined ? null : describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : describe(inPlaceOf),
      matchesBand: matchVolumeBand(snapshot.matchesCounted),
      maps: snapshot.maps,
      mapsBelowMinimum: snapshot.mapsBelowMinimum,
      modeMix: snapshot.modeMix,
      averageLengthMinutes: snapshot.averageLengthMinutes,
      perDay: snapshot.perDay,
    };
  };

  if (current === undefined) {
    return toResult(undefined, undefined);
  }

  if (options.halfSeason !== undefined) {
    return toResult(started.includes(options.halfSeason) ? options.halfSeason : undefined, undefined);
  }

  const previous = previousOf(current);

  if (previous !== undefined && !hasEnoughMatches(source, current) && hasEnoughMatches(source, previous)) {
    return toResult(previous, current);
  }

  return toResult(current, undefined);
}

function snapshotOf(source: CommunityMatchesSource, halfSeason: number): Snapshot {
  const modes = source.modes.filter((row) => row.halfSeason === halfSeason);
  const { maps, mapsBelowMinimum } = mapRecords(source.maps.filter((row) => row.halfSeason === halfSeason));

  return {
    matchesCounted: sum(modes.map((row) => row.matches)),
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

/** Win rate per map over the blended modes, split at the sample a rate needs. */
function mapRecords(rows: readonly CommunityMapRow[]): {
  maps: CommunityMapRecord[];
  mapsBelowMinimum: string[];
} {
  const tallies = new Map<string, { matches: number; wins: number }>();

  for (const row of rows.filter((candidate) => BLENDED_PLAY_MODE_IDS.includes(candidate.playModeId))) {
    const tally = tallies.get(row.mapName) ?? { matches: 0, wins: 0 };
    tally.matches += row.decidedMatches;
    tally.wins += row.wins;
    tallies.set(row.mapName, tally);
  }

  const decided = [...tallies]
    .filter(([, tally]) => tally.matches > 0)
    .map(([map, tally]) => ({ map, ...tally }));
  const enough = ({ matches }: { matches: number }): boolean => matches >= COMMUNITY_MATCHES_MINIMUMS.mapMatches;

  // Ordered by what is shown, never by how many matches a map has.
  return {
    maps: decided
      .filter(enough)
      .map(({ map, matches, wins }): CommunityMapRecord => ({ map, winRate: Math.round((wins / matches) * 100) }))
      .sort((a, b) => b.winRate - a.winRate || a.map.localeCompare(b.map)),
    mapsBelowMinimum: decided
      .filter((tally) => !enough(tally))
      .map(({ map }) => map)
      .sort((a, b) => a.localeCompare(b)),
  };
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
  return { matchesCounted: 0, maps: [], mapsBelowMinimum: [], modeMix: null, averageLengthMinutes: null, perDay: null };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
