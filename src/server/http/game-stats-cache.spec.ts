import type { IncomingMessage, ServerResponse } from 'http';

import type { GameStatsResponse } from '../../contracts/game-stats.model.ts';
import { UNSTORED_GAME_STATS_CACHE_CONTROL, gameStatsCacheControl } from './game-stats-cache.ts';
import { DEFAULT_CACHE_CONTROL, handleJsonRequest } from './vercel-api.ts';

const answerWith = (persisted: boolean): GameStatsResponse =>
  ({
    snapshot: { snapshotDate: 'November 9, 2026', capturedAt: '2026-11-09T12:10:00.000Z', persisted },
    games: [],
  }) as unknown as GameStatsResponse;

describe('gameStatsCacheControl', () => {
  it('lets the CDN keep numbers that were stored', () => {
    expect(gameStatsCacheControl(answerWith(true))).toBe(DEFAULT_CACHE_CONTROL);
    expect(DEFAULT_CACHE_CONTROL).toBe('s-maxage=300, stale-while-revalidate=3600');
  });

  it('lets the CDN keep unstored built-in numbers for seconds only, with no stale window', () => {
    expect(gameStatsCacheControl(answerWith(false))).toBe(UNSTORED_GAME_STATS_CACHE_CONTROL);
    expect(UNSTORED_GAME_STATS_CACHE_CONTROL).toBe('public, max-age=0, s-maxage=15');
    expect(UNSTORED_GAME_STATS_CACHE_CONTROL).not.toContain('stale-while-revalidate');
    expect(UNSTORED_GAME_STATS_CACHE_CONTROL).not.toContain('no-store');
  });

  it('is the header /api/game-stats sends, through the Vercel handler', async () => {
    for (const [persisted, expected] of [
      [true, DEFAULT_CACHE_CONTROL],
      [false, UNSTORED_GAME_STATS_CACHE_CONTROL],
    ] as const) {
      let headers: Record<string, string> = {};
      const res = {
        writeHead: (_status: number, sent: Record<string, string>) => {
          headers = sent;
        },
        end: () => undefined,
      } as unknown as ServerResponse;

      await handleJsonRequest({ method: 'GET' } as IncomingMessage, res, () => answerWith(persisted), {
        allowCors: true,
        cacheControl: gameStatsCacheControl,
      });

      expect(headers['cache-control']).toBe(expected);
    }
  });
});
