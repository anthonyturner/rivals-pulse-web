import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { IdentityError } from './overwolf-identity.ts';
import { hasActiveSubscription, parsePackageIds } from './overwolf-subscription.ts';

const config = { storePublicToken: 'te6h-store', extensionId: 'ext-1' };

function respondWith(status: number, body?: unknown): { fetchImpl: typeof fetch; calls: { url: string; auth: string | null }[] } {
  const calls: { url: string; auth: string | null }[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, auth: new Headers(init?.headers).get('authorization') });
    return new Response(body === undefined ? null : JSON.stringify(body), { status });
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

const plan = (state: string, packageId = 7) => ({ userId: 'u', packageId, state, recurringPaymentId: 'r' });

describe('hasActiveSubscription', () => {
  it('asks Overwolf about the store with the same bearer token', async () => {
    const { fetchImpl, calls } = respondWith(200, [plan('ACTIVE')]);

    assert.equal(await hasActiveSubscription('tok', config, { fetchImpl }), true);
    assert.equal(calls[0].url, 'https://subscriptions-api.overwolf.com/subscriptions/te6h-store?extensionId=ext-1');
    assert.equal(calls[0].auth, 'Bearer tok');
  });

  it('treats a plan that is cancelled but still running as entitled', async () => {
    const { fetchImpl } = respondWith(200, [plan('PENDING_CANCELLATION')]);

    assert.equal(await hasActiveSubscription('tok', config, { fetchImpl }), true);
  });

  it('does not treat ended plans, an empty list or a 404 as entitled', async () => {
    const ended = respondWith(200, [plan('EXPIRED'), plan('CANCELLED')]).fetchImpl;
    const empty = respondWith(200, []).fetchImpl;
    const notFound = respondWith(404).fetchImpl;

    assert.equal(await hasActiveSubscription('tok', config, { fetchImpl: ended }), false);
    assert.equal(await hasActiveSubscription('tok', config, { fetchImpl: empty }), false);
    assert.equal(await hasActiveSubscription('tok', config, { fetchImpl: notFound }), false);
  });

  it('counts only the configured packages when some are named', async () => {
    const { fetchImpl } = respondWith(200, [plan('ACTIVE', 7), plan('EXPIRED', 9)]);

    assert.equal(await hasActiveSubscription('tok', { ...config, packageIds: [7] }, { fetchImpl }), true);
    assert.equal(await hasActiveSubscription('tok', { ...config, packageIds: [9] }, { fetchImpl }), false);
    assert.equal(await hasActiveSubscription('tok', { ...config, packageIds: [] }, { fetchImpl }), true);
  });

  it('fails closed on a server error, a rejected token or an unreadable answer', async () => {
    for (const fetchImpl of [
      respondWith(500).fetchImpl,
      respondWith(401).fetchImpl,
      respondWith(200, { not: 'a list' }).fetchImpl,
      respondWith(200).fetchImpl,
    ]) {
      assert.equal(await statusOf(hasActiveSubscription('tok', config, { fetchImpl })), 503);
    }
  });

  it('fails closed when Overwolf is unreachable', async () => {
    const unreachable = (async () => { throw new TypeError('network'); }) as unknown as typeof fetch;

    assert.equal(await statusOf(hasActiveSubscription('tok', config, { fetchImpl: unreachable })), 503);
  });
});

describe('parsePackageIds', () => {
  it('reads a comma list and ignores blanks and non-numbers', () => {
    assert.deepEqual(parsePackageIds('12, 34,,x,5.5'), [12, 34]);
    assert.deepEqual(parsePackageIds(''), []);
    assert.deepEqual(parsePackageIds(undefined), []);
  });
});
