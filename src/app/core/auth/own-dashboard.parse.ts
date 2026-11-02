import type { OwnDashboardResponse } from './own-dashboard.types';

type Check = (value: unknown) => boolean;

/**
 * Reads the answer of `GET /api/account/dashboard`. It checks every field the profile page reads,
 * nested ones included, so a malformed answer becomes the page's "unavailable" state, not a thrown
 * error or an "undefined" or "NaN" on screen. Null when the body is not a dashboard answer.
 */
export function parseOwnDashboard(body: unknown): OwnDashboardResponse | null {
  const answer = asObject(body);

  if (answer?.['linked'] === false) {
    return { linked: false };
  }

  return answer?.['linked'] === true && isLinkedAnswer(answer) ? (answer as unknown as OwnDashboardResponse) : null;
}

const isString: Check = (value) => typeof value === 'string';
const isNumber: Check = (value) => typeof value === 'number' && Number.isFinite(value);
const isCount: Check = (value) => isNumber(value) && (value as number) >= 0;
const isBoolean: Check = (value) => typeof value === 'boolean';
const nullable =
  (check: Check): Check =>
  (value) =>
    value === null || check(value);
const listOf =
  (check: Check): Check =>
  (value) =>
    Array.isArray(value) && value.every(check);

/** An object whose every named field passes its check. A missing field fails, `null` only where the check allows it. */
const shape =
  (fields: Record<string, Check>): Check =>
  (value) => {
    const object = asObject(value);

    return object !== null && Object.entries(fields).every(([key, check]) => check(object[key]));
  };

const isKda = shape({
  matches: isCount,
  kills: isNumber,
  deaths: isNumber,
  assists: isNumber,
  killsPerMatch: isNumber,
  deathsPerMatch: isNumber,
  assistsPerMatch: isNumber,
  ratio: isNumber,
});

const isRate = shape({ perMinute: isNumber, samples: isCount });
const isRecord = shape({ value: isNumber, playedAt: isString, hero: nullable(isString) });

const isStats = shape({
  matches: isCount,
  wins: isCount,
  losses: isCount,
  unknownResults: isCount,
  winRate: nullable(isNumber),
  kda: nullable(isKda),
  finalHits: nullable(shape({ matches: isCount, total: isNumber, perMatch: isNumber })),
  topHeroes: listOf(
    shape({
      hero: isString,
      matches: isCount,
      wins: isCount,
      losses: isCount,
      winRate: nullable(isNumber),
      kda: nullable(isKda),
    }),
  ),
  perMinute: shape({ damage: nullable(isRate), healing: nullable(isRate), blocked: nullable(isRate) }),
  records: shape({
    mostKills: nullable(isRecord),
    mostAssists: nullable(isRecord),
    mostFinalHits: nullable(isRecord),
    longestWinStreak: isCount,
  }),
  recent: listOf(
    shape({
      playedAt: isString,
      hero: nullable(isString),
      result: nullable((value) => value === 'win' || value === 'loss'),
      kills: nullable(isNumber),
      deaths: nullable(isNumber),
      assists: nullable(isNumber),
      finalHits: nullable(isNumber),
      playModeId: nullable(isNumber),
      mapName: nullable(isString),
    }),
  ),
  firstPlayedAt: nullable(isString),
  lastPlayedAt: nullable(isString),
});

const isLinkedAnswer = shape({
  player: shape({ name: isString, avatarUrl: nullable(isString) }),
  truncated: isBoolean,
  stats: isStats,
});

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
