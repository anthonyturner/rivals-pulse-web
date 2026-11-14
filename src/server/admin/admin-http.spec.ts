import type { IncomingMessage, ServerResponse } from 'http';

import { AuthUnavailableError, type AuthGateway } from '../auth/auth-gateway';
import { adminRouteHandler, handleAdminHttp } from './admin-http';
import { ADMIN_ROUTES } from './admin-routes';

const NO_STORE = 'private, no-store, max-age=0';

const GATEWAY: AuthGateway = {
  authorizeUrl: async () => ({ url: 'https://project.supabase.co/auth/v1/authorize', verifier: 'v' }),
  exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r' }),
  resolve: async (tokens) => ({ account: { email: 'a@b.c', provider: 'discord', createdAt: '2026-11-01T00:00:00Z' }, tokens }),
  signOut: async () => undefined,
  deleteAccount: async () => 'deleted',
  linkedPlayer: async () => null,
  redeemLinkCode: async () => ({ status: 'invalid' }),
  unlinkPlayer: async () => undefined,
  readRecordsOptIn: async () => false,
  setRecordsOptIn: async (_tokens, show) => ({ status: 'saved', showInRecords: show }),
  readMediaDefaults: async () => ({ heroVideo: false, sound: false }),
  setMediaDefaults: async (_tokens, change) => ({ heroVideo: change.heroVideo ?? false, sound: change.sound ?? false }),
  readOwnDashboard: async () => ({ linked: false }),
  readOwnHeroProgressMatches: async () => ({ linked: false }),
  isAdmin: async () => true,
  beginDataJob: async () => ({ status: 'started', runId: 1 }),
  runRebuildJob: async () => 1,
  finishDataJob: async () => true,
  readDataJobs: async () => [],
};

interface Sent {
  status: number;
  headers: Record<string, unknown>;
  body?: string;
}

/** Runs one request through the Node adapter and reports what it wrote. */
async function send(
  method: string,
  route: string,
  headers: Record<string, string>,
  gateway: AuthGateway,
): Promise<Sent> {
  const sent: Sent = { status: 0, headers: {} };
  const req = {
    async *[Symbol.asyncIterator]() {
      yield* [];
    },
    method,
    url: `/api/${route}`,
    headers: { host: 'rivalspulse.com', ...headers },
  } as unknown as IncomingMessage;
  const res = {
    writeHead(status: number, responseHeaders: Record<string, unknown>) {
      sent.status = status;
      sent.headers = responseHeaders;
    },
    end(body?: string) {
      sent.body = body;
    },
  } as unknown as ServerResponse;

  await handleAdminHttp(req, res, route, () => gateway);

  return sent;
}

describe('handleAdminHttp', () => {
  const SIGNED_IN = { cookie: 'rp_session=a~r', origin: 'https://rivalspulse.com' };
  const SIGNED_OUT = { origin: 'https://rivalspulse.com' };
  const routes = [...Object.entries(ADMIN_ROUTES).map(([name, route]) => [name, route.method] as const), ['admin/nothing', 'GET'] as const];

  for (const [route, method] of routes) {
    describe(`${method} ${route}`, () => {
      const cases: [string, Record<string, string>, AuthGateway, number][] = [
        ['signed out', SIGNED_OUT, GATEWAY, 401],
        ['signed in but not an admin', SIGNED_IN, { ...GATEWAY, isAdmin: async () => false }, 403],
        ['the database being down', SIGNED_IN, { ...GATEWAY, isAdmin: async () => Promise.reject(new AuthUnavailableError('down')) }, 503],
      ];

      for (const [name, headers, gateway, status] of cases) {
        it(`answers ${status} for ${name} and marks the answer private and uncacheable`, async () => {
          spyOn(console, 'warn');

          const sent = await send(method, route, headers, gateway);

          expect(sent.status).toBe(status);
          expect(sent.headers['cache-control']).toBe(NO_STORE);
        });
      }

      it('marks an admin\'s answer private and uncacheable', async () => {
        const sent = await send(method, route, SIGNED_IN, GATEWAY);

        expect(sent.headers['cache-control']).toBe(NO_STORE);
        expect(sent.headers['content-type']).toBe('application/json; charset=utf-8');
        expect(sent.headers['cache-control']).not.toContain('s-maxage');
      });
    });
  }

  it('marks the answer private and uncacheable when the server is not configured', async () => {
    spyOn(console, 'warn');

    const req = { method: 'GET', url: '/api/admin/me', headers: { host: 'rivalspulse.com', cookie: 'rp_session=a~r' } } as unknown as IncomingMessage;
    const headers: Record<string, unknown>[] = [];
    const res = {
      writeHead: (_status: number, sent: Record<string, unknown>) => headers.push(sent),
      end: () => undefined,
    } as unknown as ServerResponse;

    await handleAdminHttp(req, res, 'admin/me', () => {
      throw new AuthUnavailableError('not configured');
    });

    expect(headers[0]['cache-control']).toBe(NO_STORE);
  });

  it('builds the function Vercel serves for one route, which refuses a visitor with no session and marks it uncacheable', async () => {
    const written: { status: number; headers: Record<string, unknown> }[] = [];
    const req = { method: 'GET', url: '/api/admin/me', headers: { host: 'rivalspulse.com' } } as unknown as IncomingMessage;
    const res = {
      writeHead: (status: number, headers: Record<string, unknown>) => written.push({ status, headers }),
      end: () => undefined,
    } as unknown as ServerResponse;

    await adminRouteHandler('admin/me')(req, res);

    expect(written[0].status).toBe(401);
    expect(written[0].headers['cache-control']).toBe(NO_STORE);
  });
});
