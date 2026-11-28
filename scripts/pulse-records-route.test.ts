import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it } from 'node:test';

import { PULSE_RECORDS_CACHE_CONTROL, respondWithPulseRecords } from '../src/server/records/pulse-records-http.ts';

/**
 * A name stays on the boards only while its owner has naming on, so the answer must leave a shared
 * cache within two minutes of the switch: `s-maxage` of 60 at most and no stale window over 60 seconds.
 */
const root = new URL('../', import.meta.url);
const MAX_SECONDS = 60;

const secondsOf = (header: string, directive: string): number | undefined => {
  const value = header.match(new RegExp(`(?:^|,\\s*)${directive}=(\\d+)`))?.[1];

  return value === undefined ? undefined : Number(value);
};

describe('the cache header of /api/records', () => {
  it('lets a shared cache keep an answer for 60 seconds at most', () => {
    const shared = secondsOf(PULSE_RECORDS_CACHE_CONTROL, 's-maxage');

    assert.ok(shared !== undefined && shared > 0 && shared <= MAX_SECONDS, PULSE_RECORDS_CACHE_CONTROL);
  });

  it('allows no stale window beyond 60 seconds, and a browser keeps nothing without asking', () => {
    for (const directive of ['stale-while-revalidate', 'stale-if-error']) {
      assert.ok((secondsOf(PULSE_RECORDS_CACHE_CONTROL, directive) ?? 0) <= MAX_SECONDS, directive);
    }
    assert.equal(secondsOf(PULSE_RECORDS_CACHE_CONTROL, 'max-age'), 0);
    assert.doesNotMatch(PULSE_RECORDS_CACHE_CONTROL, /immutable|private/);
  });

  it('is what the handler sends with a good answer', async () => {
    const sent = await send(() => Promise.resolve({ status: 'ready' }));

    assert.equal(sent.status, 200);
    assert.equal(sent.headers['cache-control'], PULSE_RECORDS_CACHE_CONTROL);
    assert.deepEqual(JSON.parse(sent.body), { status: 'ready' });
  });
});

describe('the two ways to reach /api/records', () => {
  it('are the Vercel function and the Express route, both through the one handler', () => {
    const vercel = readFileSync(new URL('api/records.ts', root), 'utf8');
    const express = readFileSync(new URL('src/server.ts', root), 'utf8');

    assert.match(vercel, /handlePulseRecordsRequest\(req, res\)/);
    assert.match(express, /app\.get\('\/api\/records', \(req, res\) => \{\s*void handlePulseRecordsRequest\(req, res\);/);
  });

  it('have no header rule in vercel.json that could replace the cache header', () => {
    const config = JSON.parse(readFileSync(new URL('vercel.json', root), 'utf8')) as { headers?: { source: string }[] };

    assert.deepEqual(
      (config.headers ?? []).filter((rule) => /records/.test(rule.source) || rule.source === '/api/(.*)'),
      [],
    );
  });
});

async function send(read: () => Promise<unknown>): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const sent = { status: 0, headers: {} as Record<string, string>, body: '' };
  const res = {
    writeHead(status: number, headers: Record<string, string>) {
      sent.status = status;
      sent.headers = headers;
    },
    end(body?: string) {
      sent.body = body ?? '';
    },
  } as unknown as ServerResponse;

  await respondWithPulseRecords({ method: 'GET' } as IncomingMessage, res, read);

  return sent;
}
