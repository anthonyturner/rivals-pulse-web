/**
 * The rules behind the participants backfill (issue 143): turning a stored `tracked_matches` row back
 * into the match the overlay uploaded, and working out what replaying it through
 * `record_match_participants` will do. Counting rules stay with `match-payload.ts` (parseParticipants,
 * rosterFingerprint, readMatchContext); this file only adapts stored rows to them and does no I/O.
 */
import {
  asRecord,
  parseParticipants,
  PayloadError,
  readHalfSeason,
  readMatchContext,
  rosterFingerprint,
  toTimestamp,
  type JsonRecord,
  type ParticipantRow,
} from '../supabase/functions/track-match-history/match-payload.ts';

/** The columns of `tracked_matches` the replay reads. */
export interface TrackedMatchRow {
  id: number;
  raw_payload: JsonRecord;
  performance: JsonRecord | null;
}

export interface HalfSeasonStart {
  half_season: number;
  starts_at: string;
}

export interface ReplayMatch {
  rowId: number;
  /**
   * Where the lines came from: the stored roster, or only the recorder's own line when the row kept
   * no roster (the newest rows drop it) and the match was found in `participants` by that player.
   */
  source: 'roster' | 'recorder-line';
  /** ISO timestamp of `match_time_stamp`; the live path's `readPlayedAt` refuses anything older than a week. */
  playedAt: string;
  /** Null when the row carries no season and no known half-season started before it. */
  halfSeason: number | null;
  fingerprint: string;
  lines: ParticipantRow[];
  playModeId: number | null;
  mapName: string | null;
  /** Whether the recorder's own roster line sits on the team their stored `camp` says. */
  recorderTeam: 'agrees' | 'disagrees' | 'not-checkable';
}

export type SkipReason = 'no-roster' | 'unreadable-roster' | 'no-timestamp';

/**
 * Season 9 arrived on this day, so no match labelled by `--before-first-half-season` can be older.
 * A guard against a wrong label, not a half-season boundary.
 */
export const EARLIEST_BEFORE_FIRST_PLAY = '2026-07-10T00:00:00Z';

/** The `record_match_participants` rule: the same fingerprint within this long is the same match. */
export const SAME_MATCH_WINDOW_MS = 4 * 60 * 1000;

/**
 * The upload the overlay made, as far as the row still shows it. A row keeps only the recorder's own
 * result, in `performance` (the whole `match_player` is not stored), so the camp and `is_win` that
 * `parseParticipants` reads from `match_player` are rebuilt from there. A wrong camp would invert
 * every line's result.
 */
export function rebuildUploadedMatch(row: Pick<TrackedMatchRow, 'raw_payload' | 'performance'>): JsonRecord {
  const local = asRecord(row.performance);
  return {
    ...row.raw_payload,
    match_player: local ? { camp: local['camp'], is_win: local['is_win'] } : undefined,
  };
}

/**
 * The half-season a match belongs to: the one the upload named, else the latest one that had started
 * by `playedAt`, else `beforeFirst` for a match older than every known start.
 */
export function placeInHalfSeason(
  raw: JsonRecord,
  playedAt: string,
  starts: readonly HalfSeasonStart[],
  beforeFirst: number | null,
): number | null {
  const named = namedHalfSeason(raw);
  if (named !== null) return named;

  const playedMs = Date.parse(playedAt);
  const started = starts
    .filter(start => Date.parse(start.starts_at) <= playedMs)
    .sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at));
  return started.length > 0 ? Number(started[0].half_season) : beforeFirst;
}

function namedHalfSeason(raw: JsonRecord): number | null {
  try {
    return readHalfSeason(raw);
  } catch (error) {
    if (error instanceof PayloadError) return null;
    throw error;
  }
}

export async function prepareReplay(
  row: TrackedMatchRow,
  starts: readonly HalfSeasonStart[],
  beforeFirst: number | null,
): Promise<{ match: ReplayMatch } | { skipped: SkipReason }> {
  const raw = row.raw_payload;
  if (!Array.isArray(raw['match_players'])) return { skipped: 'no-roster' };

  const playedAt = toTimestamp(raw['match_time_stamp']);
  if (!playedAt) return { skipped: 'no-timestamp' };

  const uploaded = rebuildUploadedMatch(row);
  let lines: ParticipantRow[];
  try {
    lines = parseParticipants(uploaded);
  } catch (error) {
    if (error instanceof PayloadError) return { skipped: 'unreadable-roster' };
    throw error;
  }

  const { play_mode_id, map_name } = readMatchContext(uploaded);
  return {
    match: {
      rowId: row.id,
      source: 'roster',
      playedAt,
      halfSeason: placeInHalfSeason(raw, playedAt, starts, beforeFirst),
      fingerprint: await rosterFingerprint(lines),
      lines,
      playModeId: play_mode_id,
      mapName: map_name,
      recorderTeam: checkRecorderTeam(lines, row.performance),
    },
  };
}

/**
 * A row that kept no roster cannot be fingerprinted, but its match may already be stored: find the
 * stored match the recorder was in at that time and replay the recorder's line under its fingerprint.
 * The repeat branch of `record_match_participants` then fills the blank mode, map and result.
 */
export async function prepareRecorderLine(
  row: TrackedMatchRow,
  stored: readonly ExistingLine[],
): Promise<ReplayMatch | null> {
  const performance = asRecord(row.performance);
  const uid = performance?.['player_uid'];
  const playedAt = toTimestamp(row.raw_payload['match_time_stamp']);
  if (typeof uid !== 'string' || !playedAt) return null;

  const home = closestStoredMatchOf(uid, Date.parse(playedAt), stored);
  if (!home) return null;

  const uploaded: JsonRecord = {
    ...rebuildUploadedMatch(row),
    match_players: [{ ...performance, cur_hero_id: undefined, nick_name: undefined }],
  };
  const { play_mode_id, map_name } = readMatchContext(uploaded);
  try {
    return {
      rowId: row.id,
      source: 'recorder-line',
      playedAt,
      halfSeason: home.halfSeason,
      fingerprint: home.fingerprint,
      lines: parseParticipants(uploaded),
      playModeId: play_mode_id,
      mapName: map_name,
      recorderTeam: 'not-checkable',
    };
  } catch (error) {
    if (error instanceof PayloadError) return null;
    throw error;
  }
}

/**
 * The stored match this player was in nearest to `playedMs`, within the repeat window. A player can
 * have two stored matches inside the window, so the first one found is not safe: a fill never
 * overwrites, and it would put one match's result and mode on another. Two different matches at the
 * same distance cannot be told apart, so that is no match at all.
 */
function closestStoredMatchOf(uid: string, playedMs: number, stored: readonly ExistingLine[]): ExistingLine | null {
  const candidates = new Map<string, { line: ExistingLine; gap: number }>();
  for (const line of stored) {
    const gap = Math.abs(Date.parse(line.playedAt) - playedMs);
    if (line.uid === uid && gap <= SAME_MATCH_WINDOW_MS) candidates.set(`${line.fingerprint}|${line.playedAt}`, { line, gap });
  }

  const nearest = Math.min(...[...candidates.values()].map(candidate => candidate.gap));
  const best = [...candidates.values()].filter(candidate => candidate.gap === nearest);
  return best.length === 1 ? best[0].line : null;
}

function checkRecorderTeam(lines: readonly ParticipantRow[], performance: JsonRecord | null): ReplayMatch['recorderTeam'] {
  const uid = performance?.['player_uid'];
  const camp = performance?.['camp'];
  const own = typeof uid === 'string' ? lines.find(line => line.uid === uid) : undefined;
  if (!own || own.team === null || typeof camp !== 'number') return 'not-checkable';
  return own.team === camp ? 'agrees' : 'disagrees';
}

/** One stored scoreboard line, as far as the comparison needs it. */
export interface ExistingLine {
  fingerprint: string;
  halfSeason: number;
  playedAt: string;
  uid: string | null;
  name: string | null;
  isWin: boolean | null;
  playModeId: number | null;
  mapName: string | null;
}

export type Outcome = 'new' | 'repeat-existing' | 'repeat-in-run' | 'frozen' | 'unplaced';

export interface PlannedMatch {
  match: ReplayMatch;
  outcome: Outcome;
  /** Decided results compared with the stored line of the same player (repeat-existing only). */
  agreed: number;
  disagreed: number;
  /** Stored results that were blank and this replay would fill. */
  resultsFilled: number;
  /** Whether the stored mode or map was blank where this replay knows it. */
  modeOrMapFilled: boolean;
}

interface MatchGroup {
  playedMs: number;
  lines: ExistingLine[] | null;
}

/**
 * What replaying `matches` (oldest first) would do, following the repeat rule of
 * `record_match_participants`: a match is a repeat when its fingerprint already has a match within
 * `SAME_MATCH_WINDOW_MS`, whether stored or added earlier in the same run. A frozen half-season is
 * left alone: its raw rows are gone, so a replay would only insert rows the purge deletes again.
 */
export function planReplay(
  matches: readonly ReplayMatch[],
  existing: readonly ExistingLine[],
  frozen: ReadonlySet<number>,
): PlannedMatch[] {
  const groups = groupStoredLines(existing);
  return matches.map(match => {
    if (match.halfSeason === null) return skipped(match, 'unplaced');
    if (frozen.has(match.halfSeason)) return skipped(match, 'frozen');

    const playedMs = Date.parse(match.playedAt);
    const known = groups.get(match.fingerprint) ?? [];
    const group = nearestGroup(known, playedMs);
    if (!group) {
      groups.set(match.fingerprint, [...known, { playedMs, lines: null }]);
      return skipped(match, 'new');
    }
    if (!group.lines) return skipped(match, 'repeat-in-run');
    return { match, outcome: 'repeat-existing', ...compareWithStored(match, group.lines) };
  });
}

/** A planned match that touches no stored line, so there is nothing to compare. */
function skipped(match: ReplayMatch, outcome: Outcome): PlannedMatch {
  return { match, outcome, agreed: 0, disagreed: 0, resultsFilled: 0, modeOrMapFilled: false };
}

/** The stored match of this roster nearest in time, within the repeat window. */
function nearestGroup(groups: readonly MatchGroup[], playedMs: number): MatchGroup | undefined {
  const inWindow = groups.filter(group => Math.abs(group.playedMs - playedMs) <= SAME_MATCH_WINDOW_MS);
  return inWindow.sort((a, b) => Math.abs(a.playedMs - playedMs) - Math.abs(b.playedMs - playedMs))[0];
}

/** Stored lines grouped into matches: the lines of one upload share a fingerprint and a start time. */
function groupStoredLines(existing: readonly ExistingLine[]): Map<string, MatchGroup[]> {
  const byFingerprint = new Map<string, Map<string, ExistingLine[]>>();
  for (const line of existing) {
    const matches = byFingerprint.get(line.fingerprint) ?? new Map<string, ExistingLine[]>();
    matches.set(line.playedAt, [...(matches.get(line.playedAt) ?? []), line]);
    byFingerprint.set(line.fingerprint, matches);
  }

  return new Map(
    [...byFingerprint].map(([fingerprint, matches]) => [
      fingerprint,
      [...matches].map(([playedAt, lines]) => ({ playedMs: Date.parse(playedAt), lines })),
    ]),
  );
}

function compareWithStored(
  match: ReplayMatch,
  stored: readonly ExistingLine[],
): Pick<PlannedMatch, 'agreed' | 'disagreed' | 'resultsFilled' | 'modeOrMapFilled'> {
  const storedByPlayer = new Map(stored.map(line => [lineKey(line), line]));
  let agreed = 0;
  let disagreed = 0;
  let resultsFilled = 0;
  for (const line of match.lines) {
    const found = storedByPlayer.get(lineKey(line));
    if (!found || line.is_win === null) continue;
    if (found.isWin === null) resultsFilled++;
    else if (found.isWin === line.is_win) agreed++;
    else disagreed++;
  }

  const modeOrMapFilled = stored.some(line =>
    (line.playModeId === null && match.playModeId !== null) || (line.mapName === null && match.mapName !== null));
  return { agreed, disagreed, resultsFilled, modeOrMapFilled };
}

/** The player a line belongs to, the way the SQL repeat branch pairs them: uid, else lower-cased name. */
function lineKey(line: { uid: string | null; name: string | null }): string {
  return line.uid !== null ? `uid:${line.uid}` : `name:${(line.name ?? '').trim().toLowerCase()}`;
}

/** Matches given the `--before-first-half-season` label that were played before Season 9 began. */
export function labelledBeforeSeason9(planned: readonly PlannedMatch[], label: number | null): PlannedMatch[] {
  if (label === null) return [];
  return planned.filter(item => item.match.halfSeason === label
    && Date.parse(item.match.playedAt) < Date.parse(EARLIEST_BEFORE_FIRST_PLAY));
}

/** The recorder written on a replayed row: a marker, since the original recorder's hash is not stored. */
export const BACKFILL_RECORDER = 'backfill-143';

/**
 * One statement that replays the given matches, oldest first, through `record_match_participants`
 * and returns each call's row count. A single statement runs in a single transaction, so a purge
 * cannot freeze a half-season that is only partly written.
 */
export function replayStatement(planned: readonly PlannedMatch[]): string {
  const values = planned.map(({ match }, index) => [
    String(index),
    literal(match.fingerprint),
    `${match.halfSeason}::numeric`,
    `${literal(match.playedAt)}::timestamptz`,
    `${literal(JSON.stringify(match.lines))}::jsonb`,
    `${match.playModeId === null ? 'null' : match.playModeId}::smallint`,
    `${match.mapName === null ? 'null' : literal(match.mapName)}::text`,
  ].join(', '));

  return [
    'select v.i, public.record_match_participants(',
    `  v.fingerprint, v.half_season, v.played_at, ${literal(BACKFILL_RECORDER)}, v.players, v.play_mode_id, v.map_name`,
    ') as written',
    `from (values ${values.map(row => `(${row})`).join(',\n')}) as v(i, fingerprint, half_season, played_at, players, play_mode_id, map_name)`,
    'order by v.i;',
  ].join('\n');
}

/** A SQL string literal; with standard_conforming_strings on (the default) only a quote needs doubling. */
function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
