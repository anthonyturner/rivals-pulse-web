import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, it } from 'node:test';

import { AuthUnavailableError, type AuthGateway } from '../src/server/auth/index.ts';
import { handleAdminRequest } from '../src/server/admin/admin-api.ts';
import { adminRouteHandler, handleAdminHttp } from '../src/server/admin/admin-http.ts';
import { ADMIN_ROUTES } from '../src/server/admin/admin-routes.ts';
import type { AccountRequest } from '../src/server/account/account-session.ts';

/**
 * The Karma specs in `src/server/admin/` cover the wrapper in detail but do not run in CI. These run
 * the same guard in the pipeline that does, so deleting the session check or the `is_admin()` check
 * turns CI red. Each request below goes through the real wrapper with a fake gateway.
 */
const TOKENS = { accessToken: 'access.jwt.value', refreshToken: 'refresh-value' };
const ACCOUNT = { email: 'admin@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };
const NO_STORE = 'private, no-store, max-age=0';

function gateway(isAdmin: () => Promise<boolean>, calls: string[] = []): AuthGateway {
  const unused = async (): Promise<never> => {
    throw new Error('not used by the admin routes');
  };

  return {
    authorizeUrl: unused,
    exchangeCode: unused,
    resolve: async (tokens) => {
      calls.push('resolve');

      return { account: ACCOUNT, tokens };
    },
    signOut: unused,
    deleteAccount: unused,
    linkedPlayer: unused,
    redeemLinkCode: unused,
    unlinkPlayer: unused,
    readOwnDashboard: unused,
    isAdmin: async () => {
      calls.push('isAdmin');

      return isAdmin();
    },
  };
}

const request = (route: string, method: string, signedIn: boolean): AccountRequest => ({
  method,
  route,
  query: new URLSearchParams(),
  host: 'rivalspulse.com',
  protocol: 'https',
  originHeader: 'https://rivalspulse.com',
  cookieHeader: signedIn ? `rp_session=${TOKENS.accessToken}~${TOKENS.refreshToken}` : undefined,
});

describe('every admin route', () => {
  for (const [route, { method }] of Object.entries(ADMIN_ROUTES)) {
    describe(`${method} ${route}`, () => {
      it('is refused with 401 to a visitor with no session, before the database is asked', async () => {
        const calls: string[] = [];
        const response = await handleAdminRequest(request(route, method, false), () => gateway(async () => true, calls));

        assert.equal(response.status, 401);
        assert.deepEqual(calls, []);
      });

      it('is refused with 403 to a signed-in account the database says is not an admin', async () => {
        const response = await handleAdminRequest(request(route, method, true), () => gateway(async () => false));

        assert.equal(response.status, 403);
      });

      it('answers 503, and does not run, when the database cannot answer', async (context) => {
        context.mock.method(console, 'warn', () => undefined);

        const response = await handleAdminRequest(
          request(route, method, true),
          () =>
            gateway(async () => {
              throw new AuthUnavailableError('down');
            }),
        );

        assert.equal(response.status, 503);
      });

      it('runs for an admin, after the session and the admin check, in that order', async () => {
        const calls: string[] = [];
        const response = await handleAdminRequest(request(route, method, true), () => gateway(async () => true, calls));

        assert.equal(response.status, 200);
        assert.deepEqual(calls, ['resolve', 'isAdmin']);
      });
    });
  }

  it('is refused to a non-admin even when it does not exist, and to an admin with 404', async () => {
    const nonAdmin = await handleAdminRequest(request('admin/nothing', 'GET', true), () => gateway(async () => false));
    const admin = await handleAdminRequest(request('admin/nothing', 'GET', true), () => gateway(async () => true));

    assert.equal(nonAdmin.status, 403);
    assert.equal(admin.status, 404);
  });
});

/** Runs a request through the Node adapter and reports what it wrote. */
async function send(
  run: (req: IncomingMessage, res: ServerResponse) => Promise<void>,
  method: string,
  cookie?: string,
): Promise<{ status: number; headers: Record<string, unknown> }> {
  const sent = { status: 0, headers: {} as Record<string, unknown> };
  const req = {
    async *[Symbol.asyncIterator]() {
      yield* [];
    },
    method,
    url: '/api/admin/me',
    headers: { host: 'rivalspulse.com', origin: 'https://rivalspulse.com', ...(cookie ? { cookie } : {}) },
  } as unknown as IncomingMessage;
  const res = {
    writeHead(status: number, headers: Record<string, unknown>) {
      sent.status = status;
      sent.headers = headers;
    },
    end() {},
  } as unknown as ServerResponse;

  await run(req, res);

  return sent;
}

describe('the answers an admin route writes', () => {
  const cookie = `rp_session=${TOKENS.accessToken}~${TOKENS.refreshToken}`;

  for (const [name, isAdmin, cookieHeader, status] of [
    ['a visitor with no session', true, undefined, 401],
    ['a signed-in account that is not an admin', false, cookie, 403],
    ['an admin', true, cookie, 200],
  ] as const) {
    it(`are private and uncacheable for ${name}`, async () => {
      const sent = await send(
        (req, res) => handleAdminHttp(req, res, 'admin/me', () => gateway(async () => isAdmin)),
        'GET',
        cookieHeader,
      );

      assert.equal(sent.status, status);
      assert.equal(sent.headers['cache-control'], NO_STORE);
    });
  }

  it('are the same through the function Vercel serves: 401, uncacheable, for a visitor with no session', async () => {
    const sent = await send(adminRouteHandler('admin/me'), 'GET');

    assert.equal(sent.status, 401);
    assert.equal(sent.headers['cache-control'], NO_STORE);
  });
});
