/**
 * The field-by-field boundary for an uploaded match (ADR-0011): only the scoreboard line of each
 * player is read, and damage, healing, accuracy, damage blocked and ult charge never are.
 * No Deno or Supabase imports, so `node --test` runs its specs.
 */

export type JsonRecord = Record<string, unknown>;

/** A payload the function refuses; the message is safe to return to the caller (HTTP 400). */
export class PayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PayloadError';
  }
}

export interface ParticipantRow {
  uid: string | null;
  name: string | null;
  team: number | null;
  hero_id: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  /** Null when the recorder could not count it (an older app, a masked player); never 0 in its place. */
  final_hits: number | null;
  is_win: boolean | null;
}

/** A 6v6 match plus slack for a spectator-free custom lobby; more than this is not a real scoreboard. */
const MAX_PARTICIPANTS = 14;
const MAX_NAME_LENGTH = 64;
const MAX_UID_LENGTH = 40;
const MAX_STAT = 999;
const MAX_MATCH_UID_LENGTH = 64;
const MAX_DURATION_SECONDS = 86_400;
const MAX_TIMESTAMP = 10_000_000_000_000;
const MAX_INT4 = 2_147_483_647;

/** Matches older than this are not live uploads, so they are not stored for others (7 days). */
const MAX_MATCH_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 10 * 60 * 1000;

export function asRecord(value: unknown): JsonRecord | null {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}

/** The scoreboard lines of every human player in the match, win or loss worked out from the recorder's result. */
export function parseParticipants(match: JsonRecord): ParticipantRow[] {
  const players = match['match_players'];
  if (!Array.isArray(players)) throw new PayloadError('match.match_players is required');
  if (players.length > MAX_PARTICIPANTS) throw new PayloadError('match.match_players has too many players');

  const local = asRecord(match['match_player']);
  const localTeam = readTeam(local?.['camp']);
  const localWon = typeof local?.['is_win'] === 'boolean' ? local['is_win'] : null;

  const rows = new Map<string, ParticipantRow>();
  for (const entry of players) {
    const player = asRecord(entry);
    if (!player || player['is_bot'] === true) continue;

    const uid = readUid(player['player_uid']);
    const name = readName(player['nick_name']);
    if (uid === null && name === null) continue;

    const team = readTeam(player['camp']);
    const row: ParticipantRow = {
      uid,
      name,
      team,
      hero_id: readCount(player['cur_hero_id'], MAX_INT4),
      kills: readCount(player['kills'], MAX_STAT),
      deaths: readCount(player['deaths'], MAX_STAT),
      assists: readCount(player['assists'], MAX_STAT),
      final_hits: readCount(player['final_hits'], MAX_STAT),
      is_win: outcomeFor(team, localTeam, localWon),
    };
    const key = playerKey(row);
    if (!rows.has(key)) rows.set(key, row);
  }

  if (rows.size === 0) throw new PayloadError('match.match_players has no identifiable players');
  return [...rows.values()];
}

/**
 * The same value whoever recorded the match: a hash of who was in it, with no time in it, so two
 * clocks a few seconds apart cannot split one match in two.
 */
export async function rosterFingerprint(rows: readonly ParticipantRow[]): Promise<string> {
  const keys = [...new Set(rows.map(playerKey))].sort();
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`v1|${keys.join('|')}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The recorder's own history row: match facts plus their own result, and none of the detailed
 * figures or other players' lines (those live in `participants`, where retention and deletion reach them).
 */
export function storableMatch(match: JsonRecord): { rawPayload: JsonRecord; performance: JsonRecord | null } {
  const rawPayload = compact({
    match_uid: readMatchUid(match),
    match_map_name: readName(match['match_map_name']),
    match_play_duration: readCount(match['match_play_duration'], MAX_DURATION_SECONDS),
    match_time_stamp: readCount(match['match_time_stamp'], MAX_TIMESTAMP),
    play_mode_id: readCount(match['play_mode_id'], 99),
    match_season: readHalfSeason(match),
  });

  const local = asRecord(match['match_player']);
  if (!local) return { rawPayload, performance: null };

  const heroName = readName(asRecord(local['player_hero'])?.['hero_name']);
  const performance = compact({
    player_uid: readUid(local['player_uid']),
    kills: readCount(local['kills'], MAX_STAT),
    deaths: readCount(local['deaths'], MAX_STAT),
    assists: readCount(local['assists'], MAX_STAT),
    final_hits: readCount(local['final_hits'], MAX_STAT),
    is_win: typeof local['is_win'] === 'boolean' ? local['is_win'] : null,
    camp: readTeam(local['camp']),
    player_hero: heroName ? { hero_name: heroName } : null,
  });
  return { rawPayload, performance };
}

export function readMatchUid(match: JsonRecord): string {
  const value = match['match_uid'];
  const uid = typeof value === 'string' ? value.trim() : '';
  if (!uid || uid.length > MAX_MATCH_UID_LENGTH) throw new PayloadError('match.match_uid is required');
  return uid;
}

/** `10` or `10.5`: a whole or half number, as the app numbers half-seasons. */
export function readHalfSeason(match: JsonRecord): number {
  const raw = match['match_season'];
  const value = typeof raw === 'number' || (typeof raw === 'string' && raw.trim()) ? Number(raw) : Number.NaN;
  if (!Number.isFinite(value) || value < 0 || value > 99 || !Number.isInteger(value * 2)) {
    throw new PayloadError('match.match_season is required');
  }
  return value;
}

/** When the match ended, as an ISO timestamp, or a refusal if it is not a recent live match. */
export function readPlayedAt(match: JsonRecord, nowMs: number): string {
  const timestamp = toTimestamp(match['match_time_stamp']);
  if (!timestamp) throw new PayloadError('match.match_time_stamp is required');
  const playedMs = Date.parse(timestamp);
  if (playedMs > nowMs + MAX_CLOCK_SKEW_MS || playedMs < nowMs - MAX_MATCH_AGE_MS) {
    throw new PayloadError('match.match_time_stamp is outside the accepted range');
  }
  return timestamp;
}

export function toTimestamp(value: unknown): string | null {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) return null;
  const milliseconds = numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
  return new Date(milliseconds).toISOString();
}

function playerKey(row: Pick<ParticipantRow, 'uid' | 'name'>): string {
  return row.uid !== null ? `uid:${row.uid}` : `name:${(row.name ?? '').toLowerCase()}`;
}

/** The recorder's result seen from this player's side; unknown whenever either side is unknown. */
function outcomeFor(team: number | null, localTeam: number | null, localWon: boolean | null): boolean | null {
  if (team === null || localTeam === null || localWon === null) return null;
  return team === localTeam ? localWon : !localWon;
}

function readUid(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const uid = String(value).trim();
  return uid && uid.length <= MAX_UID_LENGTH ? uid : null;
}

function readName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NAME_LENGTH);
  return name || null;
}

function readTeam(value: unknown): number | null {
  return readCount(value, 9);
}

/** The entries that carry a value; an absent figure stays absent rather than becoming null. */
function compact(record: Record<string, unknown>): JsonRecord {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== null));
}

function readCount(value: unknown, max: number): number | null {
  const numeric = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof numeric === 'number' && Number.isInteger(numeric) && numeric >= 0 && numeric <= max
    ? numeric
    : null;
}
