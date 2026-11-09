import { json, rateLimited, unwrapStatus, type EndpointSpec } from '../_shared/overwolf-endpoint.ts';

/** The app reads on launch and after each upload; one every half minute for an hour is generous. */
const HISTORY_LIMIT = 120;
/** The most matches one answer holds, the most the app reads at once (`MAX_UPLOADED_MATCHES`). */
const MAX_MATCHES = 500;

export interface OwnMatch {
  matchUid: string;
  playedAt: string | null;
  recordedAt: string;
  rawPayload: Record<string, unknown> | null;
  performance: Record<string, unknown> | null;
}

/**
 * `after` from the body as an ISO time Postgres always accepts, or null for every match. Anything
 * that is not a time is a bad request.
 */
function readAfter(body: unknown): string | null | undefined {
  if (body === null || typeof body !== 'object') return null;
  const after = (body as { after?: unknown }).after;
  if (after === undefined || after === null) return null;
  if (typeof after !== 'string') return undefined;
  const time = new Date(after);
  return Number.isNaN(time.getTime()) ? undefined : time.toISOString();
}

const objectOrNull = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** Keeps the five fields the app reads from each row, so nothing else the database holds can leak. */
function readMatches(data: unknown): OwnMatch[] {
  const rows = (data as { matches?: unknown }).matches;
  if (!Array.isArray(rows)) throw new Error('The database answer "ok" has no matches');
  return rows.map(row => {
    const { matchUid, playedAt, recordedAt, rawPayload, performance } = row as Record<string, unknown>;
    if (typeof matchUid !== 'string' || typeof recordedAt !== 'string') throw new Error('Malformed own match');
    return {
      matchUid,
      playedAt: typeof playedAt === 'string' ? playedAt : null,
      recordedAt,
      rawPayload: objectOrNull(rawPayload),
      performance: objectOrNull(performance),
    };
  });
}

/**
 * The verified session's own uploaded matches, newest written first, optionally only those written
 * after `after`. Only matches whose upload recorded this recorder are returned, so a caller can never
 * read another uploader's history by naming them.
 */
export const readMatchHistory: EndpointSpec = {
  methods: ['POST'],
  failureMessage: 'Unable to read the match history',
  async handle({ request, recorder, rpc }) {
    const after = readAfter(await request.json().catch(() => null));
    if (after === undefined) return json({ error: '"after" must be an ISO date and time' }, 400);

    const result = await rpc('read_own_tracked_matches', {
      p_recorder_id: recorder,
      p_after: after,
      p_max: MAX_MATCHES,
      p_limit: HISTORY_LIMIT,
    });
    const outcome = unwrapStatus(result);

    switch (outcome.status) {
      case 'rate_limited':
        return rateLimited('Too many requests; try again later', outcome.retryAfter());
      case 'ok':
        return json({ matches: readMatches(result.data) });
      default:
        throw new Error(`The database answered "${outcome.status}" to a match history read`);
    }
  },
};
