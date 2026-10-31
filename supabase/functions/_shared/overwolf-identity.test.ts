import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IdentityError, recorderId, verifyOverwolfSession } from './overwolf-identity.ts';

const NOW_MS = Date.parse('2026-10-09T12:00:00Z');

function tokenFor(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

const validToken = tokenFor({ sub: 'SomeUser', iat: NOW_MS / 1000, exp: NOW_MS / 1000 + 900 });

function respondWith(status: number): { fetchImpl: typeof fetch; calls: { url: string; auth: string | null }[] } {
  const calls: { url: string; auth: string | null }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get('authorization') });
    return new Response(null, { status });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof IdentityError) return error.status;
    throw error;
  }
  return 200;
}

describe('verifyOverwolfSession', () => {
  it('returns the username once Overwolf accepts the token', async () => {
    const { fetchImpl, calls } = respondWith(200);

    const user = await verifyOverwolfSession(validToken, 'ext-1', { fetchImpl, nowMs: NOW_MS });

    assert.deepEqual(user, { username: 'SomeUser' });
    assert.equal(calls[0].url, 'https://accounts.overwolf.com/tokens/short-lived/verify?extensionId=ext-1');
    assert.equal(calls[0].auth, `Bearer ${validToken}`);
  });

  it('prefers the username Overwolf returns, and accepts only a plain 200', async () => {
    const named = (async () => Response.json({ username: 'RealName' })) as unknown as typeof fetch;
    const noContent = respondWith(204).fetchImpl;

    assert.deepEqual(await verifyOverwolfSession(validToken, 'ext-1', { fetchImpl: named, nowMs: NOW_MS }), { username: 'RealName' });
    assert.equal(await statusOf(verifyOverwolfSession(validToken, 'ext-1', { fetchImpl: noContent, nowMs: NOW_MS })), 503);
  });

  it('rejects a missing token without calling Overwolf', async () => {
    const { fetchImpl, calls } = respondWith(200);

    assert.equal(await statusOf(verifyOverwolfSession(null, 'ext-1', { fetchImpl })), 401);
    assert.equal(calls.length, 0);
  });

  it('rejects a malformed or expired token without calling Overwolf', async () => {
    const { fetchImpl, calls } = respondWith(200);
    const expired = tokenFor({ sub: 'SomeUser', exp: NOW_MS / 1000 - 1 });

    assert.equal(await statusOf(verifyOverwolfSession('not-a-jwt', 'ext-1', { fetchImpl, nowMs: NOW_MS })), 401);
    assert.equal(await statusOf(verifyOverwolfSession(expired, 'ext-1', { fetchImpl, nowMs: NOW_MS })), 401);
    assert.equal(calls.length, 0);
  });

  it('rejects a token Overwolf refuses', async () => {
    const { fetchImpl } = respondWith(401);

    assert.equal(await statusOf(verifyOverwolfSession(validToken, 'ext-1', { fetchImpl, nowMs: NOW_MS })), 401);
  });

  it('fails closed when Overwolf is down or unreachable', async () => {
    const down = respondWith(500).fetchImpl;
    const unreachable = (async () => { throw new TypeError('network'); }) as unknown as typeof fetch;

    assert.equal(await statusOf(verifyOverwolfSession(validToken, 'ext-1', { fetchImpl: down, nowMs: NOW_MS })), 503);
    assert.equal(await statusOf(verifyOverwolfSession(validToken, 'ext-1', { fetchImpl: unreachable, nowMs: NOW_MS })), 503);
  });
});

describe('recorderId', () => {
  it('is stable, case-insensitive and does not contain the username', async () => {
    const first = await recorderId('SomeUser', 'secret');

    assert.equal(first, await recorderId('someuser', 'secret'));
    assert.equal(first.includes('someuser'), false);
    assert.match(first, /^[0-9a-f]{64}$/);
  });

  it('changes with the secret and with the user', async () => {
    const base = await recorderId('SomeUser', 'secret');

    assert.notEqual(base, await recorderId('SomeUser', 'other-secret'));
    assert.notEqual(base, await recorderId('OtherUser', 'secret'));
  });
});
