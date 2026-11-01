import type { OwnDashboardResponse } from './own-dashboard.types';

/**
 * Reads the answer of `GET /api/account/dashboard`. It checks the parts the profile page reads, so
 * a malformed answer becomes the page's "unavailable" state, not a blank panel or a thrown error.
 * Null when the body is not a dashboard answer.
 */
export function parseOwnDashboard(body: unknown): OwnDashboardResponse | null {
  const answer = asObject(body);

  if (answer?.['linked'] === false) {
    return { linked: false };
  }

  const player = asObject(answer?.['player']);
  const stats = asObject(answer?.['stats']);

  return answer?.['linked'] === true &&
    typeof player?.['name'] === 'string' &&
    (player['avatarUrl'] === null || typeof player['avatarUrl'] === 'string') &&
    typeof answer['truncated'] === 'boolean' &&
    isStats(stats)
    ? (answer as unknown as OwnDashboardResponse)
    : null;
}

function isStats(stats: Record<string, unknown> | null): boolean {
  return (
    stats !== null &&
    ['matches', 'wins', 'losses', 'unknownResults'].every((key) => isCount(stats[key])) &&
    isNullable(stats['winRate'], isFiniteNumber) &&
    isNullable(stats['kda'], isObject) &&
    isNullable(stats['finalHits'], isObject) &&
    isListOf(stats['topHeroes'], (hero) => typeof hero['hero'] === 'string' && isCount(hero['matches'])) &&
    isListOf(stats['recent'], (match) => typeof match['playedAt'] === 'string') &&
    isObject(stats['perMinute']) &&
    isRecords(asObject(stats['records'])) &&
    isNullable(stats['firstPlayedAt'], isString) &&
    isNullable(stats['lastPlayedAt'], isString)
  );
}

function isRecords(records: Record<string, unknown> | null): boolean {
  return records !== null && isCount(records['longestWinStreak']);
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isObject(value: unknown): boolean {
  return asObject(value) !== null;
}

function isString(value: unknown): boolean {
  return typeof value === 'string';
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): boolean {
  return isFiniteNumber(value) && (value as number) >= 0;
}

function isNullable(value: unknown, check: (value: unknown) => boolean): boolean {
  return value === null || check(value);
}

function isListOf(value: unknown, check: (item: Record<string, unknown>) => boolean): boolean {
  return Array.isArray(value) && value.every((item) => {
    const object = asObject(item);

    return object !== null && check(object);
  });
}
