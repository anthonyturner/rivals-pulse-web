import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Both ways to reach `/api/game-stats` must take their `Cache-Control` from the one decision in
 * `gameStatsCacheControl`, or one of them would let the CDN keep unstored stand-in numbers.
 */
const root = new URL('../', import.meta.url);

describe('the two ways to reach /api/game-stats', () => {
  it('choose the cache header with gameStatsCacheControl', () => {
    const vercel = readFileSync(new URL('api/game-stats.ts', root), 'utf8');
    const express = readFileSync(new URL('src/server.ts', root), 'utf8');

    assert.match(vercel, /cacheControl: gameStatsCacheControl/);
    assert.match(
      express,
      /app\.get\('\/api\/game-stats'[\s\S]*?syncGameStats\(getSupabaseClient\(\)\), gameStatsCacheControl\)/,
    );
  });
});
