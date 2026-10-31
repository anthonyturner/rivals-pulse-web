import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { checkPremiumGate } from './premium-gate.ts';

const NOW_MS = Date.parse('2026-10-09T12:00:00Z');

function tokenFor(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

const sessionToken = tokenFor({ sub: 'SomeUser', iat: NOW_MS / 1000, exp: NOW_MS / 1000 + 900 });
const gateOn: Record<string, string> = { TEBEX_STORE_PUBLIC_TOKEN: 'store', OVERWOLF_EXTENSION_ID: 'ext-1' };

/** Answers Overwolf's verify call with 200 and the subscriptions call with `subscriptions`. */
function overwolf(subscriptions: Response): { fetchImpl: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    return url.includes('accounts.overwolf.com') ? Response.json({ username: 'SomeUser' }) : subscriptions.clone();
  }) as unknown as typeof fetch;
  return { fetchImpl, urls };
}

function gate(env: Record<string, string>, session: string | null, fetchImpl: typeof fetch) {
  return checkPremiumGate({ getEnv: name => env[name], getSessionToken: () => session, fetchImpl, nowMs: NOW_MS });
}

describe('checkPremiumGate', () => {
  let warn: ReturnType<typeof mock.method>;
  beforeEach(() => { warn = mock.method(console, 'warn', () => undefined); });
  afterEach(() => { mock.restoreAll(); });

  it('is dormant while the store token is unset: no session read, no Overwolf call', async () => {
    const { fetchImpl, urls } = overwolf(Response.json([]));
    let sessionReads = 0;

    for (const env of [{}, { TEBEX_STORE_PUBLIC_TOKEN: '  ' }]) {
      const decision = await checkPremiumGate({
        getEnv: name => (env as Record<string, string>)[name],
        getSessionToken: () => { sessionReads++; return null; },
        fetchImpl,
      });
      assert.deepEqual(decision, { allowed: true });
    }
    assert.equal(sessionReads, 0);
    assert.equal(urls.length, 0);
  });

  it('refuses a missing session with 401 without calling Overwolf', async () => {
    const { fetchImpl, urls } = overwolf(Response.json([]));

    assert.deepEqual(await gate(gateOn, null, fetchImpl), {
      allowed: false,
      status: 401,
      body: { error: 'An Overwolf session token is required' },
    });
    assert.equal(urls.length, 0);
  });

  it('refuses a verified user with no plan with 403 premium-required', async () => {
    const { fetchImpl } = overwolf(new Response(null, { status: 404 }));

    assert.deepEqual(await gate(gateOn, sessionToken, fetchImpl), {
      allowed: false,
      status: 403,
      body: { error: 'premium-required' },
    });
  });

  it('allows a verified subscriber', async () => {
    const { fetchImpl } = overwolf(Response.json([{ packageId: 7, state: 'ACTIVE' }]));

    assert.deepEqual(await gate(gateOn, sessionToken, fetchImpl), { allowed: true });
  });

  it('fails closed with 503 when the subscription check is down, even for a subscriber', async () => {
    const { fetchImpl } = overwolf(new Response(null, { status: 500 }));

    const decision = await gate(gateOn, sessionToken, fetchImpl);

    assert.equal(decision.allowed, false);
    assert.equal(decision.allowed === false && decision.status, 503);
  });

  it('fails closed when the package list is set but names no usable id', async () => {
    const { fetchImpl, urls } = overwolf(Response.json([{ packageId: 7, state: 'ACTIVE' }]));

    const decision = await gate({ ...gateOn, PREMIUM_JARVIS_PACKAGE_IDS: '12;34' }, sessionToken, fetchImpl);

    assert.equal(decision.allowed, false);
    assert.equal(urls.length, 0);
  });

  it('logs a refusal without the session token', async () => {
    const { fetchImpl } = overwolf(new Response(null, { status: 404 }));

    await gate(gateOn, sessionToken, fetchImpl);

    const logged = warn.mock.calls.flatMap(call => call.arguments).join(' ');
    assert.match(logged, /403/);
    assert.equal(logged.includes(sessionToken), false);
  });
});
