import type { GameStatsResponse } from '../../contracts/game-stats.model.ts';
import { DEFAULT_CACHE_CONTROL, NO_STORE_CACHE_CONTROL } from './vercel-api.ts';

/**
 * The `Cache-Control` of a `/api/game-stats` answer, for the Vercel function and the Express route
 * alike. Numbers that were stored may be kept by the CDN like any other; built-in stand-ins
 * (`snapshot.persisted` false: Steam answered for no game, or the store failed) must not be, or the
 * CDN would keep serving them for minutes after the cause is gone.
 */
export function gameStatsCacheControl(response: Pick<GameStatsResponse, 'snapshot'>): string {
  return response.snapshot.persisted ? DEFAULT_CACHE_CONTROL : NO_STORE_CACHE_CONTROL;
}
