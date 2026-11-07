import { json, type AccountRequest } from '../account/account-session';
import { AuthUnavailableError, type AuthGateway } from '../auth/auth-gateway';
import { handleAdminRequest } from './admin-api';
import { ADMIN_ROUTES, type AdminRoute } from './admin-routes';

const TOKENS = { accessToken: 'access.jwt.value', refreshToken: 'refresh-value' };
const ACCOUNT = { email: 'admin@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };
const SESSION_COOKIE = `rp_session=${TOKENS.accessToken}~${TOKENS.refreshToken}`;

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    authorizeUrl: async () => ({ url: 'https://project.supabase.co/auth/v1/authorize', verifier: 'v' }),
    exchangeCode: async () => TOKENS,
    resolve: async (tokens) => ({ account: ACCOUNT, tokens }),
    signOut: async () => undefined,
    deleteAccount: async () => 'deleted',
    linkedPlayer: async () => null,
    redeemLinkCode: async () => ({ status: 'invalid' }),
    unlinkPlayer: async () => undefined,
    readOwnDashboard: async () => ({ linked: false }),
    isAdmin: async () => true,
    beginDataJob: async () => ({ status: 'started', runId: 1 }),
    runRebuildJob: async () => 1,
    finishDataJob: async () => true,
    readDataJobs: async () => [],
    ...overrides,
  };
}

function request(route: string, overrides: Partial<AccountRequest> = {}): AccountRequest {
  return {
    method: 'GET',
    route,
    query: new URLSearchParams(),
    host: 'rivalspulse.com',
    protocol: 'https',
    cookieHeader: SESSION_COOKIE,
    ...overrides,
  };
}

const post = (route: string, overrides: Partial<AccountRequest> = {}): AccountRequest =>
  request(route, { method: 'POST', originHeader: 'https://rivalspulse.com', ...overrides });

/** The body a POST route needs to get as far as running. A rebuild, so no sync reaches the network. */
const BODIES: Record<string, unknown> = { 'admin/data-jobs-run': { job: 'recompute-hero-aggregates' } };

describe('handleAdminRequest', () => {
  const routeNames = Object.keys(ADMIN_ROUTES);

  it('has at least one admin route to test', () => {
    expect(routeNames.length).toBeGreaterThan(0);
  });

  for (const name of routeNames) {
    const method = ADMIN_ROUTES[name].method;
    const asked = (overrides: Partial<AccountRequest> = {}): AccountRequest =>
      method === 'POST' ? post(name, { body: BODIES[name], ...overrides }) : request(name, overrides);

    describe(name, () => {
      it('answers 401 when signed out, without asking the database anything', async () => {
        const isAdmin = jasmine.createSpy('isAdmin').and.resolveTo(true);
        const response = await handleAdminRequest(asked({ cookieHeader: undefined }), () => gateway({ isAdmin }));

        expect(response.status).toBe(401);
        expect(isAdmin).not.toHaveBeenCalled();
      });

      it('answers 401 and clears the cookie when the session is no longer valid', async () => {
        const response = await handleAdminRequest(asked(), () => gateway({ resolve: async () => undefined }));

        expect(response.status).toBe(401);
        expect(response.cookies[0]).toContain('rp_session=;');
      });

      it('answers 403 to a signed-in account that is not an admin', async () => {
        const response = await handleAdminRequest(asked(), () => gateway({ isAdmin: async () => false }));

        expect(response.status).toBe(403);
        expect(JSON.stringify(response.body)).not.toContain('"admin":true');
      });

      it('runs for an admin', async () => {
        const response = await handleAdminRequest(asked(), () => gateway());

        expect(response.status).toBe(200);
      });
    });
  }

  it('asks the database with the verified tokens, on every request', async () => {
    const isAdmin = jasmine.createSpy('isAdmin').and.resolveTo(true);
    const refreshed = { accessToken: 'new.jwt', refreshToken: 'new-refresh' };
    const open = (): Promise<unknown> =>
      handleAdminRequest(
        request('admin/me'),
        () => gateway({ isAdmin, resolve: async () => ({ account: ACCOUNT, tokens: refreshed }) }),
      );

    await open();
    await open();

    expect(isAdmin).toHaveBeenCalledTimes(2);
    expect(isAdmin).toHaveBeenCalledWith(refreshed);
  });

  it('refuses a made-up route to a non-admin with the same 403 as a real one', async () => {
    const real = await handleAdminRequest(request('admin/me'), () => gateway({ isAdmin: async () => false }));
    const made = await handleAdminRequest(request('admin/nothing'), () => gateway({ isAdmin: async () => false }));

    expect(made.status).toBe(403);
    expect(made.body).toEqual(real.body);
  });

  it('answers 401 to a signed-out caller on a made-up route too', async () => {
    const response = await handleAdminRequest(request('admin/nothing', { cookieHeader: undefined }), () => gateway());

    expect(response.status).toBe(401);
  });

  it('answers 404 to an admin on a route it does not have, including names every object has', async () => {
    for (const name of ['admin/nothing', 'admin/constructor', 'admin/__proto__', 'account/dashboard']) {
      expect((await handleAdminRequest(request(name), () => gateway())).status).toBe(404);
    }
  });

  it('answers 405 to an admin who uses the wrong method', async () => {
    const response = await handleAdminRequest(post('admin/me'), () => gateway());

    expect(response.status).toBe(405);
  });

  it('keeps the refreshed session cookie on a refusal, so a rotated refresh token is not lost', async () => {
    const response = await handleAdminRequest(
      request('admin/me'),
      () =>
        gateway({
          isAdmin: async () => false,
          resolve: async () => ({ account: ACCOUNT, tokens: { accessToken: 'new.jwt', refreshToken: 'new-refresh' } }),
        }),
    );

    expect(response.status).toBe(403);
    expect(response.cookies[0]).toContain('rp_session=new.jwt~new-refresh');
  });

  it('answers 503, never 403, when the database cannot say whether the account is an admin', async () => {
    spyOn(console, 'warn');

    const response = await handleAdminRequest(
      request('admin/me'),
      () => gateway({ isAdmin: async () => Promise.reject(new AuthUnavailableError('down')) }),
    );

    expect(response.status).toBe(503);
  });

  it('answers 503 when Supabase is not configured', async () => {
    spyOn(console, 'warn');

    const response = await handleAdminRequest(request('admin/me'), () => {
      throw new AuthUnavailableError('Sign-in is not configured.');
    });

    expect(response.status).toBe(503);
  });

  it('answers 500, saying nothing of the cause, when a route throws', async () => {
    spyOn(console, 'error');
    const routes: Record<string, AdminRoute> = {
      'admin/boom': { method: 'GET', run: async () => Promise.reject(new Error('secret detail')) },
    };
    const response = await handleAdminRequest(request('admin/boom'), () => gateway(), routes);

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('secret detail');
  });

  describe('a POST route', () => {
    const run = jasmine.createSpy('run');
    const routes: Record<string, AdminRoute> = {
      'admin/act': {
        method: 'POST',
        run: async (context) => {
          run(context.request.body, context.tokens);

          return json(200, { done: true });
        },
      },
    };

    beforeEach(() => run.calls.reset());

    it('is refused a foreign Origin, even to an admin, and never runs', async () => {
      const foreign = await handleAdminRequest(post('admin/act', { originHeader: 'https://evil.example' }), () => gateway(), routes);
      const missing = await handleAdminRequest(post('admin/act', { originHeader: undefined }), () => gateway(), routes);

      expect(foreign.status).toBe(403);
      expect(missing.status).toBe(403);
      expect(run).not.toHaveBeenCalled();
    });

    it('is refused to a non-admin and a signed-out caller, and never runs', async () => {
      const nonAdmin = await handleAdminRequest(post('admin/act'), () => gateway({ isAdmin: async () => false }), routes);
      const signedOut = await handleAdminRequest(post('admin/act', { cookieHeader: undefined }), () => gateway(), routes);

      expect([nonAdmin.status, signedOut.status]).toEqual([403, 401]);
      expect(run).not.toHaveBeenCalled();
    });

    it('runs for an admin on the same site, with the body and the admin\'s own tokens', async () => {
      const response = await handleAdminRequest(post('admin/act', { body: { interval: 'hourly' } }), () => gateway(), routes);

      expect(response.status).toBe(200);
      expect(run).toHaveBeenCalledOnceWith({ interval: 'hourly' }, TOKENS);
    });
  });
});
