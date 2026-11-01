import { handleAccountRequest, type AccountRequest, type AccountResponse } from './account-api';
import { AuthUnavailableError, type AuthGateway } from './auth-gateway';

const TOKENS = { accessToken: 'access.jwt.value', refreshToken: 'refresh-value' };
const ACCOUNT = { email: 'player@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };
const SESSION_COOKIE = `rp_session=${TOKENS.accessToken}~${TOKENS.refreshToken}`;
const PKCE_COOKIE = `rp_pkce=${encodeURIComponent(JSON.stringify({ verifier: 'the-verifier', next: '/account' }))}`;
const AUTHORIZE_URL = 'https://project.supabase.co/auth/v1/authorize?x=1';

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    authorizeUrl: async () => ({ url: AUTHORIZE_URL, verifier: 'the-verifier' }),
    exchangeCode: async () => TOKENS,
    resolve: async (tokens) => ({ account: ACCOUNT, tokens }),
    signOut: async () => undefined,
    deleteAccount: async () => 'deleted',
    ...overrides,
  };
}

function request(route: string, overrides: Partial<AccountRequest> = {}): AccountRequest {
  return { method: 'GET', route, query: new URLSearchParams(), host: 'rivalspulse.com', protocol: 'https', ...overrides };
}

const run = (req: AccountRequest, gw: AuthGateway = gateway()): Promise<AccountResponse> =>
  handleAccountRequest(req, () => gw);

/** The `next` address a start request stored in its sign-in cookie. */
function storedNext(response: AccountResponse): string {
  const value = response.cookies[0].split(';')[0].replace('rp_pkce=', '');

  return JSON.parse(decodeURIComponent(value)).next;
}

describe('GET auth/session', () => {
  it('answers signed out, with no email or id, when there is no cookie', async () => {
    const response = await run(request('auth/session'));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ signedIn: false });
    expect(response.cookies).toEqual([]);
  });

  it('answers signed out and clears the cookie when the session is no longer valid', async () => {
    const response = await run(
      request('auth/session', { cookieHeader: SESSION_COOKIE }),
      gateway({ resolve: async () => undefined }),
    );

    expect(response.body).toEqual({ signedIn: false });
    expect(response.cookies.length).toBe(1);
    expect(response.cookies[0]).toContain('rp_session=;');
    expect(response.cookies[0]).toContain('Max-Age=0');
  });

  it('returns the account without any id when signed in', async () => {
    const response = await run(request('auth/session', { cookieHeader: SESSION_COOKIE }));

    expect(response.body).toEqual({ signedIn: true, account: ACCOUNT });
    expect(JSON.stringify(response.body)).not.toContain('"id"');
    expect(response.cookies).toEqual([]);
  });

  it('stores the new tokens when the access token had to be refreshed', async () => {
    const response = await run(
      request('auth/session', { cookieHeader: SESSION_COOKIE }),
      gateway({
        resolve: async () => ({ account: ACCOUNT, tokens: { accessToken: 'new.jwt', refreshToken: 'new-refresh' } }),
      }),
    );

    expect(response.cookies.length).toBe(1);
    expect(response.cookies[0]).toContain('rp_session=new.jwt~new-refresh');
  });
});

describe('GET auth/discord/start', () => {
  it('sends the browser to Supabase and keeps the verifier in a cookie, not in the address', async () => {
    let redirectTo = '';
    const response = await run(
      request('auth/discord/start', { query: new URLSearchParams({ next: '/account' }) }),
      gateway({
        authorizeUrl: async (_provider, target) => {
          redirectTo = target;

          return { url: AUTHORIZE_URL, verifier: 'the-verifier' };
        },
      }),
    );

    expect(response.status).toBe(302);
    expect(response.location).toBe(AUTHORIZE_URL);
    expect(redirectTo).toBe('https://rivalspulse.com/api/auth/callback');
    expect(response.cookies[0]).toContain('rp_pkce=');
    expect(response.cookies[0]).toContain('HttpOnly');
    expect(response.location).not.toContain('the-verifier');
  });

  it('uses http for localhost', async () => {
    let redirectTo = '';

    await run(
      request('auth/discord/start', { host: 'localhost:4200', protocol: undefined }),
      gateway({
        authorizeUrl: async (_provider, target) => {
          redirectTo = target;

          return { url: AUTHORIZE_URL, verifier: 'v' };
        },
      }),
    );

    expect(redirectTo).toBe('http://localhost:4200/api/auth/callback');
  });

  it('is refused on a preview deployment', async () => {
    const response = await run(request('auth/discord/start', { host: 'rivals-pulse-web-git-x.vercel.app' }));

    expect(response.status).toBe(403);
    expect(response.cookies).toEqual([]);
  });

  for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example', '/api/auth/sign-out', 'account']) {
    it(`falls back to the account page for the return address ${next}`, async () => {
      const response = await run(request('auth/discord/start', { query: new URLSearchParams({ next }) }));

      expect(storedNext(response)).toBe('/account');
    });
  }

  it('keeps a return address on this site', async () => {
    const response = await run(request('auth/discord/start', { query: new URLSearchParams({ next: '/account?a=1' }) }));

    expect(storedNext(response)).toBe('/account?a=1');
  });
});

describe('GET auth/callback', () => {
  const callback = (query: Record<string, string>, cookieHeader: string | undefined = PKCE_COOKIE) =>
    request('auth/callback', { query: new URLSearchParams(query), cookieHeader });

  it('keeps the session in a cookie and returns to the page the visitor came from', async () => {
    let received: [string, string] | undefined;
    const response = await run(
      callback({ code: 'abc' }),
      gateway({
        exchangeCode: async (code, verifier) => {
          received = [code, verifier];

          return TOKENS;
        },
      }),
    );

    expect(received).toEqual(['abc', 'the-verifier']);
    expect(response.status).toBe(302);
    expect(response.location).toBe('/account');
    expect(response.cookies[0]).toContain(SESSION_COOKIE);
    expect(response.cookies[0]).toContain('HttpOnly; Secure; SameSite=Lax');
    expect(response.cookies[1]).toContain('rp_pkce=;');
  });

  it('goes back to sign-in when Supabase refuses the code', async () => {
    const response = await run(callback({ code: 'bad' }), gateway({ exchangeCode: async () => undefined }));

    expect(response.location).toBe('/sign-in?error=failed');
    expect(response.cookies.join()).not.toContain('rp_session=access');
  });

  it('goes back to sign-in when the visitor cancelled at Discord', async () => {
    const response = await run(callback({ error: 'access_denied' }));

    expect(response.location).toBe('/sign-in?error=cancelled');
  });

  it('does not exchange a code without the verifier cookie', async () => {
    let exchanged = false;
    const response = await run(
      callback({ code: 'abc' }, ''),
      gateway({
        exchangeCode: async () => {
          exchanged = true;

          return TOKENS;
        },
      }),
    );

    expect(exchanged).toBeFalse();
    expect(response.location).toBe('/sign-in?error=cancelled');
  });

  it('is refused on a preview deployment', async () => {
    const response = await run({ ...callback({ code: 'abc' }), host: 'rivals-pulse-web-git-x.vercel.app' });

    expect(response.status).toBe(403);
  });

  it('reports a session too big for one cookie as a failed sign-in', async () => {
    spyOn(console, 'error');
    const response = await run(
      callback({ code: 'abc' }),
      gateway({ exchangeCode: async () => ({ accessToken: 'a'.repeat(5000), refreshToken: 'r' }) }),
    );

    expect(response.location).toBe('/sign-in?error=failed');
  });
});

describe('POST auth/sign-out', () => {
  const post = (overrides: Partial<AccountRequest> = {}) =>
    request('auth/sign-out', {
      method: 'POST',
      originHeader: 'https://rivalspulse.com',
      cookieHeader: SESSION_COOKIE,
      ...overrides,
    });

  it('ends the session and clears the cookie', async () => {
    let signedOut = false;
    const response = await run(
      post(),
      gateway({
        signOut: async () => {
          signedOut = true;
        },
      }),
    );

    expect(signedOut).toBeTrue();
    expect(response.body).toEqual({ signedIn: false });
    expect(response.cookies[0]).toContain('rp_session=;');
    expect(response.cookies[0]).toContain('Max-Age=0');
  });

  it('clears the cookie even when there was no session', async () => {
    const response = await run(post({ cookieHeader: undefined }));

    expect(response.status).toBe(200);
    expect(response.cookies[0]).toContain('Max-Age=0');
  });

  it('refuses a POST from another origin', async () => {
    let signedOut = false;
    const response = await run(
      post({ originHeader: 'https://evil.example' }),
      gateway({
        signOut: async () => {
          signedOut = true;
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(response.cookies).toEqual([]);
    expect(signedOut).toBeFalse();
  });

  it('refuses a POST with no Origin header or one that is not an address', async () => {
    expect((await run(post({ originHeader: undefined }))).status).toBe(403);
    expect((await run(post({ originHeader: 'null' }))).status).toBe(403);
  });

  it('refuses a look-alike origin', async () => {
    expect((await run(post({ originHeader: 'https://rivalspulse.com.evil.example' }))).status).toBe(403);
  });

  it('accepts a localhost origin with its port', async () => {
    const response = await run(post({ host: 'localhost:4200', originHeader: 'http://localhost:4200', protocol: 'http' }));

    expect(response.status).toBe(200);
  });
});

describe('POST account/delete', () => {
  const ASKED = { mode: 'account', confirmation: 'delete my account' };
  const post = (overrides: Partial<AccountRequest> = {}) =>
    request('account/delete', {
      method: 'POST',
      originHeader: 'https://rivalspulse.com',
      cookieHeader: SESSION_COOKIE,
      body: ASKED,
      ...overrides,
    });
  /** A gateway that records the sessions it was asked to delete. */
  const recording = (result: 'deleted' | 'not-signed-in' = 'deleted') => {
    const seen = { tokens: [] as unknown[] };

    return {
      seen,
      gateway: gateway({
        deleteAccount: async (tokens) => {
          seen.tokens.push(tokens);

          return result;
        },
      }),
    };
  };

  it('deletes the account for the session in the cookie and signs the player out', async () => {
    const { seen, gateway: gw } = recording();
    const response = await run(post(), gw);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: true });
    expect(seen.tokens).toEqual([TOKENS]);
    expect(response.cookies.length).toBe(1);
    expect(response.cookies[0]).toContain('rp_session=;');
    expect(response.cookies[0]).toContain('Max-Age=0');
  });

  it('accepts the phrase in any case with spaces around it', async () => {
    const { seen, gateway: gw } = recording();

    expect((await run(post({ body: { ...ASKED, confirmation: '  Delete My Account ' } }), gw)).status).toBe(200);
    expect(seen.tokens.length).toBe(1);
  });

  const unconfirmed: [string, unknown][] = [
    ['no body', undefined],
    ['a body that is not an object', 'delete my account'],
    ['no confirmation', { mode: 'account' }],
    ['a confirmation that is not text', { mode: 'account', confirmation: true }],
    ['the wrong phrase', { mode: 'account', confirmation: 'yes' }],
    ['an empty phrase', { mode: 'account', confirmation: '' }],
    ['an unknown mode', { mode: 'everything', confirmation: 'delete my account' }],
    ['no mode', { confirmation: 'delete my account' }],
  ];

  for (const [name, body] of unconfirmed) {
    it(`deletes nothing and keeps the session with ${name}`, async () => {
      const { seen, gateway: gw } = recording();
      const response = await run(post({ body }), gw);

      expect(response.status).toBe(400);
      expect(seen.tokens).toEqual([]);
      expect(response.cookies).toEqual([]);
    });
  }

  it('refuses the forget-me mode for now, and deletes nothing', async () => {
    const { seen, gateway: gw } = recording();
    const response = await run(post({ body: { mode: 'account-and-matches', confirmation: 'delete my account' } }), gw);

    expect(response.status).toBe(409);
    expect(seen.tokens).toEqual([]);
    expect(response.cookies).toEqual([]);
  });

  it('needs a session cookie', async () => {
    const { seen, gateway: gw } = recording();
    const response = await run(post({ cookieHeader: undefined }), gw);

    expect(response.status).toBe(401);
    expect(seen.tokens).toEqual([]);
  });

  it('answers 401 and clears the cookie when the session is no longer valid', async () => {
    const response = await run(post(), recording('not-signed-in').gateway);

    expect(response.status).toBe(401);
    expect(response.cookies[0]).toContain('Max-Age=0');
  });

  it('refuses a POST from another origin, or with none, before doing anything', async () => {
    const { seen, gateway: gw } = recording();

    expect((await run(post({ originHeader: 'https://evil.example' }), gw)).status).toBe(403);
    expect((await run(post({ originHeader: undefined }), gw)).status).toBe(403);
    expect((await run(post({ originHeader: 'https://rivalspulse.com.evil.example' }), gw)).status).toBe(403);
    expect(seen.tokens).toEqual([]);
  });

  it('is a POST route only', async () => {
    expect((await run(post({ method: 'GET' }))).status).toBe(405);
  });

  it('keeps the session and says 503 when the deletion could not be made', async () => {
    spyOn(console, 'warn');
    const response = await run(
      post(),
      gateway({
        deleteAccount: async () => {
          throw new AuthUnavailableError('service key refused');
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.cookies).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('service key');
  });
});

describe('every other case', () => {
  it('rejects the wrong method for a known route', async () => {
    expect((await run(request('auth/sign-out', { method: 'GET' }))).status).toBe(405);
  });

  it('answers 404 for an unknown account route', async () => {
    expect((await run(request('account/anything'))).status).toBe(404);
  });

  it('answers 503 when Supabase cannot be reached', async () => {
    spyOn(console, 'warn');
    const response = await run(
      request('auth/session', { cookieHeader: SESSION_COOKIE }),
      gateway({
        resolve: async () => {
          throw new AuthUnavailableError('down');
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('down');
  });

  it('answers 503 when sign-in is not configured', async () => {
    spyOn(console, 'warn');
    const response = await handleAccountRequest(request('auth/session', { cookieHeader: SESSION_COOKIE }), () => {
      throw new AuthUnavailableError('not configured');
    });

    expect(response.status).toBe(503);
  });

  it('answers a signed-out session read without needing Supabase at all', async () => {
    const response = await handleAccountRequest(request('auth/session'), () => {
      throw new AuthUnavailableError('not configured');
    });

    expect(response.body).toEqual({ signedIn: false });
  });

  it('answers 500 without detail for an unexpected failure', async () => {
    spyOn(console, 'error');
    const response = await run(
      request('auth/session', { cookieHeader: SESSION_COOKIE }),
      gateway({
        resolve: async () => {
          throw new Error('secret detail');
        },
      }),
    );

    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });
});
