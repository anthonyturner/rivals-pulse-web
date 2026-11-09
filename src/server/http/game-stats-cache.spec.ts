import type { IncomingMessage, ServerResponse } from 'http';

import type { GameStatsResponse } from '../../contracts/game-stats.model.ts';
import { gameStatsCacheControl } from './game-stats-cache.ts';
import { DEFAULT_CACHE_CONTROL, NO_STORE_CACHE_CONTROL, handleJsonRequest } from './vercel-api.ts';

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

  it('keeps unstored built-in numbers out of the CDN', () => {
    expect(gameStatsCacheControl(answerWith(false))).toBe(NO_STORE_CACHE_CONTROL);
  });

  it('is the header /api/game-stats sends, through the Vercel handler', async () => {
    for (const [persisted, expected] of [
      [true, DEFAULT_CACHE_CONTROL],
      [false, NO_STORE_CACHE_CONTROL],
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
