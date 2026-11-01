import type { IncomingMessage, ServerResponse } from 'http';

import { handleAccountHttp, isAccountRoute } from './account-http';
import type { AuthGateway } from './auth-gateway';

const GATEWAY: AuthGateway = {
  authorizeUrl: async () => ({ url: 'https://project.supabase.co/auth/v1/authorize', verifier: 'v' }),
  exchangeCode: async () => ({ accessToken: 'a', refreshToken: 'r' }),
  resolve: async (tokens) => ({ account: { email: 'a@b.c', provider: 'discord', createdAt: '2026-11-01T00:00:00Z' }, tokens }),
  signOut: async () => undefined,
  deleteAccount: async () => 'deleted',
};

interface Sent {
  status: number;
  headers: Record<string, unknown>;
  body?: string;
}

/** Runs one request through the Node adapter and reports what it wrote. */
async function send(
  method: string,
  url: string,
  route: string,
  headers: Record<string, string> = {},
  gateway: AuthGateway = GATEWAY,
  body?: string | object,
): Promise<Sent> {
  const sent: Sent = { status: 0, headers: {} };
  const parsed = typeof body === 'object' ? { body } : {};
  const chunks = typeof body === 'string' ? [new TextEncoder().encode(body)] : [];
  const req = {
    async *[Symbol.asyncIterator]() {
      yield* chunks;
    },
    method,
    url,
    headers: { host: 'rivalspulse.com', ...headers },
    ...parsed,
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

  await handleAccountHttp(req, res, route, () => gateway);

  return sent;
}

describe('handleAccountHttp', () => {
  const cases: [string, string, string, Record<string, string>][] = [
    ['a signed-out session read', 'GET', 'auth/session', {}],
    ['a signed-in session read', 'GET', 'auth/session', { cookie: 'rp_session=a~r' }],
    ['a refused foreign POST', 'POST', 'auth/sign-out', { origin: 'https://evil.example' }],
    ['a sign-out', 'POST', 'auth/sign-out', { origin: 'https://rivalspulse.com', cookie: 'rp_session=a~r' }],
    ['the sign-in start redirect', 'GET', 'auth/discord/start', {}],
    ['a sign-in callback with no cookie', 'GET', 'auth/callback', {}],
    ['an unknown account route', 'GET', 'account/nothing', {}],
  ];

  for (const [name, method, route, headers] of cases) {
    it(`marks ${name} private and uncacheable`, async () => {
      const sent = await send(method, `/api/${route}`, route, headers);

      expect(sent.headers['cache-control']).toBe('private, no-store, max-age=0');
    });
  }

  it('sends the cookies the routes ask for as separate Set-Cookie headers', async () => {
    const sent = await send('GET', '/api/auth/callback?code=abc', 'auth/callback', {
      cookie: `rp_pkce=${encodeURIComponent(JSON.stringify({ verifier: 'v', next: '/account' }))}`,
    });

    expect(sent.status).toBe(302);
    expect(sent.headers['location']).toBe('/account');
    expect((sent.headers['set-cookie'] as string[]).length).toBe(2);
  });

  it('writes JSON for an answer with a body', async () => {
    const sent = await send('GET', '/api/auth/session', 'auth/session');

    expect(sent.headers['content-type']).toBe('application/json; charset=utf-8');
    expect(JSON.parse(sent.body ?? '')).toEqual({ signedIn: false });
  });

  it('takes the host a proxy forwarded, not the one it connected to', async () => {
    const sent = await send('POST', '/api/auth/sign-out', 'auth/sign-out', {
      host: 'internal-host',
      'x-forwarded-host': 'rivalspulse.com',
      origin: 'https://rivalspulse.com',
    });

    expect(sent.status).toBe(200);
  });
});

describe('handleAccountHttp account deletion', () => {
  const headers = { origin: 'https://rivalspulse.com', cookie: 'rp_session=a~r' };
  const asked = JSON.stringify({ mode: 'account', confirmation: 'delete my account' });

  /** A gateway whose deleteAccount records that it ran. */
  const watching = () => {
    const state = { deleted: false };

    return {
      state,
      gateway: {
        ...GATEWAY,
        deleteAccount: async () => {
          state.deleted = true;

          return 'deleted' as const;
        },
      },
    };
  };

  it('reads the JSON body from the request stream, as Express hands it over', async () => {
    const { state, gateway } = watching();
    const sent = await send('POST', '/api/account/delete', 'account/delete', headers, gateway, asked);

    expect(sent.status).toBe(200);
    expect(state.deleted).toBeTrue();
    expect(sent.headers['cache-control']).toBe('private, no-store, max-age=0');
    expect((sent.headers['set-cookie'] as string[])[0]).toContain('Max-Age=0');
  });

  it('uses the body Vercel has already parsed', async () => {
    const { state, gateway } = watching();
    const sent = await send('POST', '/api/account/delete', 'account/delete', headers, gateway, {
      mode: 'account',
      confirmation: 'delete my account',
    });

    expect(sent.status).toBe(200);
    expect(state.deleted).toBeTrue();
  });

  it('treats a body that is not JSON as no confirmation', async () => {
    const { state, gateway } = watching();
    const sent = await send('POST', '/api/account/delete', 'account/delete', headers, gateway, '{not json');

    expect(sent.status).toBe(400);
    expect(state.deleted).toBeFalse();
  });

  it('ignores a body bigger than the routes could need', async () => {
    const { state, gateway } = watching();
    const huge = JSON.stringify({ mode: 'account', confirmation: 'delete my account', pad: 'x'.repeat(10_000) });
    const sent = await send('POST', '/api/account/delete', 'account/delete', headers, gateway, huge);

    expect(sent.status).toBe(400);
    expect(state.deleted).toBeFalse();
  });

  it('refuses a foreign Origin without deleting', async () => {
    const { state, gateway } = watching();
    const sent = await send(
      'POST',
      '/api/account/delete',
      'account/delete',
      { ...headers, origin: 'https://evil.example' },
      gateway,
      asked,
    );

    expect(sent.status).toBe(403);
    expect(sent.headers['cache-control']).toBe('private, no-store, max-age=0');
    expect(state.deleted).toBeFalse();
  });
});

describe('isAccountRoute', () => {
  it('claims the auth and account paths only', () => {
    expect(isAccountRoute('auth/session')).toBeTrue();
    expect(isAccountRoute('account/delete')).toBeTrue();
    expect(isAccountRoute('heroes')).toBeFalse();
    expect(isAccountRoute('authors')).toBeFalse();
  });
});
