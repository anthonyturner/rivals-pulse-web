import type { GameStatsResponse } from '../../contracts/game-stats.model.ts';
import { DEFAULT_CACHE_CONTROL } from './vercel-api.ts';

/**
 * What the CDN may keep of built-in stand-in numbers: fifteen seconds, with no stale window. During
 * a Steam or database outage every uncached visit runs the whole Steam read (each up to 5 seconds)
 * and a store attempt, so a short shared copy caps that at a few runs a minute. With no
 * `stale-while-revalidate`, the first answer after the cause is gone is a real one, within seconds.
 */
export const UNSTORED_GAME_STATS_CACHE_CONTROL = 'public, max-age=0, s-maxage=15';

/**
 * The `Cache-Control` of a `/api/game-stats` answer, for the Vercel function and the Express route
 * alike. Numbers that were stored may be kept by the CDN like any other; built-in stand-ins
 * (`snapshot.persisted` false: Steam answered for no game, or the store failed) are kept only
 * briefly, so the CDN does not serve them for minutes after the cause is gone.
 */
export function gameStatsCacheControl(response: Pick<GameStatsResponse, 'snapshot'>): string {
  return response.snapshot.persisted ? DEFAULT_CACHE_CONTROL : UNSTORED_GAME_STATS_CACHE_CONTROL;
}
