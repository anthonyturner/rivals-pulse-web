import { json, rateLimited, unwrapStatus, type EndpointSpec } from '../_shared/overwolf-endpoint.ts';

/** Player details open one player at a time; four a minute for an hour is generous. */
const SCOREBOARD_LIMIT = 240;
/** The most matches one answer holds, the app's own read limit. */
const MAX_LINES = 200;
/** Longer than any uid the game issues; a longer value is not a uid. */
const MAX_UID_LENGTH = 64;

export interface ScoreboardLine {
  matchUid: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
}

const figure = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

/** Keeps the match key and the three figures, so no name or other player's line can leak. */
function readLines(data: unknown): ScoreboardLine[] {
  const rows = (data as { lines?: unknown }).lines;
  if (!Array.isArray(rows)) throw new Error('The database answer "ok" has no lines');
  return rows.map(row => {
    const { matchUid, kills, deaths, assists } = row as Record<string, unknown>;
    if (typeof matchUid !== 'string') throw new Error('Malformed scoreboard line');
    return { matchUid, kills: figure(kills), deaths: figure(deaths), assists: figure(assists) };
  });
}

/**
 * One player's kills, deaths and assists in the uploaded matches they played, for a verified
 * session. It answers with nothing that names anyone: the uid the caller asked for, the match key
 * and the three figures.
 */
export const readPlayerScoreboard: EndpointSpec = {
  methods: ['POST'],
  failureMessage: 'Unable to read the player scoreboard',
  async handle({ request, recorder, rpc }) {
    const body = await request.json().catch(() => null) as { playerUid?: unknown } | null;
    const uid = typeof body?.playerUid === 'string' ? body.playerUid.trim() : '';
    if (!uid || uid.length > MAX_UID_LENGTH) return json({ error: 'A player uid is required' }, 400);

    const result = await rpc('read_player_scoreboard_lines', {
      p_recorder_id: recorder,
      p_player_uid: uid,
      p_max: MAX_LINES,
      p_limit: SCOREBOARD_LIMIT,
    });
    const outcome = unwrapStatus(result);

    switch (outcome.status) {
      case 'rate_limited':
        return rateLimited('Too many requests; try again later', outcome.retryAfter());
      case 'ok': {
        const lines = readLines(result.data);
        return json({ lines, limited: lines.length >= MAX_LINES });
      }
      default:
        throw new Error(`The database answered "${outcome.status}" to a scoreboard read`);
    }
  },
};
