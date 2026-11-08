import { handleAccountRequest } from './account-api';
import type { AccountRequest, AccountResponse } from './account-session';
import { AuthUnavailableError, type AuthGateway, type OwnDashboardRead, type RedeemResult } from '../auth/auth-gateway';
import type { OwnDashboardLine } from './own-dashboard';

const TOKENS = { accessToken: 'access.jwt.value', refreshToken: 'refresh-value' };
const ACCOUNT = { email: 'player@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };
const SESSION_COOKIE = `rp_session=${TOKENS.accessToken}~${TOKENS.refreshToken}`;
const NOW_MS = 1_800_000_000_000;
const signedInCookie = (secondsAgo: number): string => `${SESSION_COOKIE}~${NOW_MS / 1000 - secondsAgo}`;
const PKCE_COOKIE = `rp_pkce=${encodeURIComponent(JSON.stringify({ verifier: 'the-verifier', next: '/account' }))}`;
const AUTHORIZE_URL = 'https://project.supabase.co/auth/v1/authorize?x=1';

function gateway(overrides: Partial<AuthGateway> = {}): AuthGateway {
  return {
    authorizeUrl: async () => ({ url: AUTHORIZE_URL, verifier: 'the-verifier' }),
    exchangeCode: async () => TOKENS,
    resolve: async (tokens) => ({ account: ACCOUNT, tokens }),
    signOut: async () => undefined,
    deleteAccount: async () => 'deleted',
    linkedPlayer: async () => null,
    redeemLinkCode: async () => ({ status: 'invalid' }),
    unlinkPlayer: async () => undefined,
    readRecordsOptIn: async () => false,
    setRecordsOptIn: async (_tokens, show) => ({ status: 'saved', showInRecords: show }),
    readOwnDashboard: async () => ({ linked: false }),
    isAdmin: async () => false,
    beginDataJob: async () => ({ status: 'started', runId: 1 }),
    runRebuildJob: async () => 1,
    finishDataJob: async () => true,
    readDataJobs: async () => [],
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

    expect(response.body).toEqual({ signedIn: true, account: ACCOUNT, player: null, isAdmin: false });
    expect(JSON.stringify(response.body)).not.toContain('"id"');
    expect(response.cookies).toEqual([]);
  });

  it('says isAdmin only when the database does, and asks it with the verified tokens', async () => {
    const isAdmin = jasmine.createSpy('isAdmin').and.resolveTo(true);
    const response = await run(request('auth/session', { cookieHeader: SESSION_COOKIE }), gateway({ isAdmin }));

    expect(response.body).toEqual({ signedIn: true, account: ACCOUNT, player: null, isAdmin: true });
    expect(isAdmin).toHaveBeenCalledOnceWith(TOKENS);
  });

  it('reads an admin check the database cannot answer as not an admin, and still signs the visitor in', async () => {
    spyOn(console, 'warn');

    const response = await run(
      request('auth/session', { cookieHeader: SESSION_COOKIE }),
      gateway({ isAdmin: async () => Promise.reject(new AuthUnavailableError('down')) }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ signedIn: true, account: ACCOUNT, player: null, isAdmin: false });
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

  it('keeps the original sign-in time when the tokens are refreshed', async () => {
    const response = await run(
      request('auth/session', { cookieHeader: signedInCookie(120) }),
      gateway({
        resolve: async () => ({ account: ACCOUNT, tokens: { accessToken: 'new.jwt', refreshToken: 'new-refresh' } }),
      }),
    );

    expect(response.cookies[0]).toContain(`rp_session=new.jwt~new-refresh~${NOW_MS / 1000 - 120};`);
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

  for (const next of [
    '//evil.example',
    'https://evil.example',
    '/\\evil.example',
    '/.//evil.example',
    '/\t/evil.example',
    '/api/auth/sign-out',
    '',
  ]) {
    it(`falls back to the account page for the return address ${next}`, async () => {
      const response = await run(request('auth/discord/start', { query: new URLSearchParams({ next }) }));

      expect(storedNext(response)).toBe('/account');
    });
  }

  it('reduces a return address to its path and query on this site', async () => {
    const response = await run(
      request('auth/discord/start', { query: new URLSearchParams({ next: '/heroes/../account?a=1#frag' }) }),
    );

    expect(storedNext(response)).toBe('/account?a=1');
  });

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

  it('records when the player signed in, from the request clock', async () => {
    const response = await run({ ...callback({ code: 'abc' }), nowMs: NOW_MS });

    expect(response.cookies[0]).toContain(`${SESSION_COOKIE}~${NOW_MS / 1000};`);
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

  it('still clears the cookie when Supabase cannot be reached or is not configured', async () => {
    spyOn(console, 'warn');
    const unconfigured = await handleAccountRequest(post(), () => {
      throw new AuthUnavailableError('not configured');
    });
    const unreachable = await run(
      post(),
      gateway({
        signOut: async () => {
          throw new AuthUnavailableError('down');
        },
      }),
    );

    for (const response of [unconfigured, unreachable]) {
      expect(response.status).toBe(200);
      expect(response.cookies[0]).toContain('rp_session=;');
      expect(response.cookies[0]).toContain('Max-Age=0');
    }
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
      cookieHeader: signedInCookie(60),
      body: ASKED,
      nowMs: NOW_MS,
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
    expect(seen.tokens).toEqual([{ ...TOKENS, signedInAt: NOW_MS / 1000 - 60 }]);
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

  describe('recent sign-in', () => {
    it('accepts a sign-in exactly ten minutes old', async () => {
      const { seen, gateway: gw } = recording();

      expect((await run(post({ cookieHeader: signedInCookie(600) }), gw)).status).toBe(200);
      expect(seen.tokens.length).toBe(1);
    });

    const tooOld: [string, string][] = [
      ['older than ten minutes', signedInCookie(601)],
      ['a session from before the time was recorded', SESSION_COOKIE],
      ['a sign-in time in the future', signedInCookie(-5)],
    ];

    for (const [name, cookieHeader] of tooOld) {
      it(`asks the player to sign in again, and deletes nothing, with ${name}`, async () => {
        const { seen, gateway: gw } = recording();
        const response = await run(post({ cookieHeader }), gw);

        expect(response.status).toBe(401);
        expect(response.body).toEqual({
          error: jasmine.any(String),
          reason: 'recent-sign-in-required',
        });
        expect(seen.tokens).toEqual([]);
        expect(response.cookies).toEqual([]);
      });
    }

    it('checks the phrase first, so a bad request is not sent to sign in', async () => {
      const response = await run(
        post({ cookieHeader: signedInCookie(3600), body: { mode: 'account', confirmation: 'no' } }),
      );

      expect(response.status).toBe(400);
    });
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
    expect(JSON.stringify(response.body)).toContain('deletion did not go through');
    expect(JSON.stringify(response.body)).not.toContain('Sign-in');
  });
});

describe('GET auth/session with a linked player', () => {
  it('returns the linked player beside the account', async () => {
    const player = { name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' };
    const response = await run(
      request('auth/session', { cookieHeader: SESSION_COOKIE }),
      gateway({ linkedPlayer: async () => player }),
    );

    expect(response.body).toEqual({ signedIn: true, account: ACCOUNT, player, isAdmin: false });
  });

  it('reads the link with the tokens Supabase confirmed, not the ones in the cookie', async () => {
    const seen: string[] = [];

    await run(
      request('auth/session', { cookieHeader: SESSION_COOKIE }),
      gateway({
        resolve: async () => ({ account: ACCOUNT, tokens: { accessToken: 'new.jwt', refreshToken: 'new-refresh' } }),
        linkedPlayer: async (tokens) => {
          seen.push(tokens.accessToken);

          return null;
        },
      }),
    );

    expect(seen).toEqual(['new.jwt']);
  });

  it('does not look for a link when the visitor is signed out', async () => {
    const asked = jasmine.createSpy('linkedPlayer').and.resolveTo(null);

    await run(request('auth/session'), gateway({ linkedPlayer: asked }));

    expect(asked).not.toHaveBeenCalled();
  });
});

describe('POST account/link', () => {
  const REFUSED = 'That code is wrong or has expired. Get a new one from the desktop app.';
  const PLAYER = { name: 'Aurora', avatarUrl: null };
  const post = (overrides: Partial<AccountRequest> = {}) =>
    request('account/link', {
      method: 'POST',
      originHeader: 'https://rivalspulse.com',
      cookieHeader: SESSION_COOKIE,
      body: { code: 'abcd-efgh' },
      ...overrides,
    });
  /** A gateway that records the canonical codes it was asked to redeem. */
  const redeeming = (result: RedeemResult) => {
    const seen: string[] = [];

    return {
      seen,
      gateway: gateway({
        redeemLinkCode: async (_tokens, code) => {
          seen.push(code);

          return result;
        },
      }),
    };
  };

  it('links the account and returns the player', async () => {
    const { seen, gateway: gw } = redeeming({ status: 'linked', player: PLAYER });
    const response = await run(post(), gw);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ player: PLAYER });
    expect(seen).toEqual(['ABCDEFGH']);
  });

  it('reads the code the way a person types it', async () => {
    const { seen, gateway: gw } = redeeming({ status: 'linked', player: PLAYER });

    await run(post({ body: { code: ' o1il 7k-q2 ' } }), gw);

    expect(seen).toEqual(['01117KQ2']);
  });

  it('gives a wrong, used or expired code the one message and links nothing', async () => {
    const { gateway: gw } = redeeming({ status: 'invalid' });
    const response = await run(post(), gw);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: REFUSED });
  });

  it('gives a code that cannot be one the same message, without asking Supabase to count a try', async () => {
    const { seen, gateway: gw } = redeeming({ status: 'linked', player: PLAYER });

    for (const body of [{ code: 'short' }, { code: 'ABCDEFGHJ' }, { code: 'ABCD-EFGU' }, { code: 12345678 }, {}, 'text', undefined]) {
      const response = await run(post({ body }), gw);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: REFUSED });
    }

    expect(seen).toEqual([]);
  });

  it('tells an account with too many wrong codes to try again later', async () => {
    const { gateway: gw } = redeeming({ status: 'rate-limited', retryAfterSeconds: 601 });
    const response = await run(post(), gw);

    expect(response.status).toBe(429);
    expect(response.body).toEqual({
      error: 'Too many wrong codes. Try again in 11 minutes.',
      retryAfterSeconds: 601,
    });
  });

  it('says "1 minute", not "1 minutes", for a wait of a minute or less', async () => {
    for (const retryAfterSeconds of [1, 60]) {
      const { gateway: gw } = redeeming({ status: 'rate-limited', retryAfterSeconds });

      expect((await run(post(), gw)).body).toEqual({
        error: 'Too many wrong codes. Try again in 1 minute.',
        retryAfterSeconds,
      });
    }
  });

  it('needs a session cookie, and redeems nothing without one', async () => {
    const { seen, gateway: gw } = redeeming({ status: 'linked', player: PLAYER });
    const response = await run(post({ cookieHeader: undefined }), gw);

    expect(response.status).toBe(401);
    expect(seen).toEqual([]);
  });

  it('answers 401 and clears the cookie when the session is no longer valid', async () => {
    const response = await run(post(), gateway({ resolve: async () => undefined }));

    expect(response.status).toBe(401);
    expect(response.cookies[0]).toContain('Max-Age=0');
  });

  it('stores the new tokens when the access token had to be refreshed', async () => {
    const response = await run(
      post(),
      gateway({
        resolve: async () => ({ account: ACCOUNT, tokens: { accessToken: 'new.jwt', refreshToken: 'new-refresh' } }),
        redeemLinkCode: async () => ({ status: 'linked', player: PLAYER }),
      }),
    );

    expect(response.cookies[0]).toContain('rp_session=new.jwt~new-refresh');
  });

  it('says 503 and keeps the session when Supabase cannot be asked', async () => {
    spyOn(console, 'warn');
    const response = await run(
      post(),
      gateway({
        redeemLinkCode: async () => {
          throw new AuthUnavailableError('down');
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.cookies).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('down');
  });

  it('refuses a POST from another origin, or with none, before doing anything', async () => {
    const { seen, gateway: gw } = redeeming({ status: 'linked', player: PLAYER });

    expect((await run(post({ originHeader: 'https://evil.example' }), gw)).status).toBe(403);
    expect((await run(post({ originHeader: undefined }), gw)).status).toBe(403);
    expect(seen).toEqual([]);
  });

  it('is a POST route only', async () => {
    expect((await run(post({ method: 'GET' }))).status).toBe(405);
  });
});

describe('account/records-opt-in', () => {
  const get = (overrides: Partial<AccountRequest> = {}) =>
    request('account/records-opt-in', { cookieHeader: SESSION_COOKIE, ...overrides });
  const post = (body: unknown, overrides: Partial<AccountRequest> = {}) =>
    request('account/records-opt-in', {
      method: 'POST',
      originHeader: 'https://rivalspulse.com',
      cookieHeader: SESSION_COOKIE,
      body,
      ...overrides,
    });

  it('reads the setting with the verified tokens, and answers only the choice', async () => {
    const read = jasmine.createSpy('readRecordsOptIn').and.resolveTo(true);
    const response = await run(get(), gateway({ readRecordsOptIn: read }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ showInRecords: true });
    expect(read).toHaveBeenCalledOnceWith(TOKENS);
  });

  it('needs a session to read, and reads nothing without one', async () => {
    const read = jasmine.createSpy('readRecordsOptIn').and.resolveTo(true);
    const response = await run(get({ cookieHeader: undefined }), gateway({ readRecordsOptIn: read }));

    expect(response.status).toBe(401);
    expect(read).not.toHaveBeenCalled();
  });

  it('says 503, never "off", when the setting cannot be read', async () => {
    spyOn(console, 'warn');
    const response = await run(
      get(),
      gateway({
        readRecordsOptIn: async () => {
          throw new AuthUnavailableError('down');
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain('showInRecords');
  });

  for (const show of [true, false]) {
    it(`saves ${show ? 'on' : 'off'} for the session's account and answers the saved choice`, async () => {
      const set = jasmine.createSpy('setRecordsOptIn').and.callFake(async (_tokens: unknown, value: boolean) => ({
        status: 'saved',
        showInRecords: value,
      }));
      const response = await run(post({ show }), gateway({ setRecordsOptIn: set }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ showInRecords: show });
      expect(set).toHaveBeenCalledOnceWith(TOKENS, show);
    });
  }

  it('ignores any account named in the body, because only the session decides whose setting changes', async () => {
    const set = jasmine.createSpy('setRecordsOptIn').and.resolveTo({ status: 'saved', showInRecords: true });

    await run(post({ show: true, userId: 'someone-else', user_id: 'someone-else' }), gateway({ setRecordsOptIn: set }));

    expect(set).toHaveBeenCalledOnceWith(TOKENS, true);
  });

  it('answers 409 with a plain reason when there is no link to turn it on for', async () => {
    const response = await run(post({ show: true }), gateway({ setRecordsOptIn: async () => ({ status: 'not-linked' }) }));

    expect(response.status).toBe(409);
    expect((response.body as { error: string }).error).toContain('Link the desktop app first');
  });

  it('refuses anything that is not a true or false, and changes nothing', async () => {
    const set = jasmine.createSpy('setRecordsOptIn').and.resolveTo({ status: 'saved', showInRecords: false });

    for (const body of [undefined, null, {}, { show: 'true' }, { show: 1 }, { show: null }, 'true', []]) {
      expect((await run(post(body), gateway({ setRecordsOptIn: set }))).status).toBe(400);
    }

    expect(set).not.toHaveBeenCalled();
  });

  it('needs a session cookie to change, and changes nothing without one', async () => {
    const set = jasmine.createSpy('setRecordsOptIn').and.resolveTo({ status: 'saved', showInRecords: true });
    const response = await run(post({ show: true }, { cookieHeader: undefined }), gateway({ setRecordsOptIn: set }));

    expect(response.status).toBe(401);
    expect(set).not.toHaveBeenCalled();
  });

  it('refuses a POST from another origin, or with none, before doing anything', async () => {
    const set = jasmine.createSpy('setRecordsOptIn').and.resolveTo({ status: 'saved', showInRecords: true });

    expect((await run(post({ show: true }, { originHeader: 'https://evil.example' }), gateway({ setRecordsOptIn: set }))).status).toBe(403);
    expect((await run(post({ show: true }, { originHeader: undefined }), gateway({ setRecordsOptIn: set }))).status).toBe(403);
    expect(set).not.toHaveBeenCalled();
  });

  it('says 503 when Supabase cannot be asked to save', async () => {
    spyOn(console, 'warn');
    const response = await run(
      post({ show: true }),
      gateway({
        setRecordsOptIn: async () => {
          throw new AuthUnavailableError('down');
        },
      }),
    );

    expect(response.status).toBe(503);
  });

  it('allows GET and POST only', async () => {
    expect((await run(request('account/records-opt-in', { method: 'DELETE', originHeader: 'https://rivalspulse.com', cookieHeader: SESSION_COOKIE }))).status).toBe(405);
  });
});

describe('POST account/unlink', () => {
  const post = (overrides: Partial<AccountRequest> = {}) =>
    request('account/unlink', {
      method: 'POST',
      originHeader: 'https://rivalspulse.com',
      cookieHeader: SESSION_COOKIE,
      ...overrides,
    });

  it('unlinks the account and answers with no player', async () => {
    const unlinked: unknown[] = [];
    const response = await run(
      post(),
      gateway({
        unlinkPlayer: async (tokens) => {
          unlinked.push(tokens);
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ player: null });
    expect(unlinked).toEqual([{ accessToken: TOKENS.accessToken, refreshToken: TOKENS.refreshToken }]);
  });

  it('needs a session cookie, and unlinks nothing without one', async () => {
    const unlink = jasmine.createSpy('unlinkPlayer').and.resolveTo(undefined);
    const response = await run(post({ cookieHeader: undefined }), gateway({ unlinkPlayer: unlink }));

    expect(response.status).toBe(401);
    expect(unlink).not.toHaveBeenCalled();
  });

  it('says 503 when Supabase cannot be asked', async () => {
    spyOn(console, 'warn');
    const response = await run(
      post(),
      gateway({
        unlinkPlayer: async () => {
          throw new AuthUnavailableError('down');
        },
      }),
    );

    expect(response.status).toBe(503);
  });

  it('refuses a POST from another origin before doing anything', async () => {
    const unlink = jasmine.createSpy('unlinkPlayer').and.resolveTo(undefined);

    expect((await run(post({ originHeader: 'https://evil.example' }), gateway({ unlinkPlayer: unlink }))).status).toBe(403);
    expect(unlink).not.toHaveBeenCalled();
  });

  it('is a POST route only', async () => {
    expect((await run(post({ method: 'GET' }))).status).toBe(405);
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

describe('GET account/dashboard', () => {
  const PLAYER = { name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' };
  const LINE: OwnDashboardLine = {
    playedAt: '2026-10-30T20:00:00+00:00',
    heroId: 1011,
    kills: 12,
    deaths: 4,
    assists: 6,
    finalHits: null,
    isWin: true,
    playModeId: 1,
    mapName: 'Tokyo 2099',
    figures: [],
  };
  const get = (overrides: Partial<AccountRequest> = {}) =>
    request('account/dashboard', { cookieHeader: SESSION_COOKIE, ...overrides });
  const reading = (read: OwnDashboardRead) => gateway({ readOwnDashboard: async () => read });

  it('answers the derived stats of a linked player, and no line', async () => {
    const response = await run(get(), reading({ linked: true, player: PLAYER, truncated: false, lines: [LINE] }));
    const body = response.body as {
      linked: boolean;
      player: unknown;
      truncated: boolean;
      stats: { matches: number; wins: number };
    };

    expect(response.status).toBe(200);
    expect(body.linked).toBeTrue();
    expect(body.player).toEqual(PLAYER);
    expect(body.truncated).toBeFalse();
    expect(body.stats.matches).toBe(1);
    expect(body.stats.wins).toBe(1);
    expect(Object.keys(body).sort()).toEqual(['linked', 'player', 'stats', 'truncated']);
    expect(JSON.stringify(body)).not.toContain('"lines"');
    expect(JSON.stringify(body)).not.toMatch(/recorder|uid/i);
  });

  it('says so when the lines were cut off by the cap', async () => {
    const response = await run(get(), reading({ linked: true, player: PLAYER, truncated: true, lines: [LINE] }));

    expect((response.body as { truncated: boolean }).truncated).toBeTrue();
  });

  it('answers an account with no link as not linked', async () => {
    const response = await run(get(), reading({ linked: false }));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ linked: false });
  });

  it('reads with the tokens Supabase confirmed, not the ones in the cookie', async () => {
    const seen: unknown[] = [];

    await run(
      get(),
      gateway({
        resolve: async () => ({ account: ACCOUNT, tokens: { accessToken: 'new.jwt', refreshToken: 'new-refresh' } }),
        readOwnDashboard: async (tokens) => {
          seen.push(tokens);

          return { linked: false };
        },
      }),
    );

    expect(seen).toEqual([{ accessToken: 'new.jwt', refreshToken: 'new-refresh' }]);
  });

  it('needs a session cookie, and reads nothing without one', async () => {
    const read = jasmine.createSpy('readOwnDashboard').and.resolveTo({ linked: false });
    const response = await run(get({ cookieHeader: undefined }), gateway({ readOwnDashboard: read }));

    expect(response.status).toBe(401);
    expect(read).not.toHaveBeenCalled();
  });

  it('answers 401 and clears the cookie when the session is no longer valid', async () => {
    const response = await run(get(), gateway({ resolve: async () => undefined }));

    expect(response.status).toBe(401);
    expect(response.cookies[0]).toContain('Max-Age=0');
  });

  it('stores the new tokens when the access token had to be refreshed', async () => {
    const response = await run(
      get(),
      gateway({
        resolve: async () => ({ account: ACCOUNT, tokens: { accessToken: 'new.jwt', refreshToken: 'new-refresh' } }),
      }),
    );

    expect(response.cookies[0]).toContain('rp_session=new.jwt~new-refresh');
  });

  it('says 503 and keeps the session when Supabase cannot be asked', async () => {
    spyOn(console, 'warn');
    const response = await run(
      get(),
      gateway({
        readOwnDashboard: async () => {
          throw new AuthUnavailableError('down');
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(response.cookies).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('down');
    expect((response.body as { error: string }).error).toContain('dashboard');
  });

  it('is a GET route only, and a POST from another origin is refused first', async () => {
    const read = jasmine.createSpy('readOwnDashboard').and.resolveTo({ linked: false });
    const posted = request('account/dashboard', { method: 'POST', cookieHeader: SESSION_COOKIE });

    expect((await run({ ...posted, originHeader: 'https://rivalspulse.com' }, gateway({ readOwnDashboard: read }))).status).toBe(405);
    expect((await run({ ...posted, originHeader: 'https://evil.example' }, gateway({ readOwnDashboard: read }))).status).toBe(403);
    expect(read).not.toHaveBeenCalled();
  });
});

describe('a session that was refreshed during the request', () => {
  const REFRESHED = { accessToken: 'new.jwt', refreshToken: 'new-refresh' };
  const NEW_COOKIE = 'rp_session=new.jwt~new-refresh';
  const refreshing = (overrides: Partial<AuthGateway>): AuthGateway =>
    gateway({ resolve: async () => ({ account: ACCOUNT, tokens: REFRESHED }), ...overrides });
  const down = async (): Promise<never> => {
    throw new AuthUnavailableError('down');
  };
  const broken = async (): Promise<never> => {
    throw new Error('secret detail');
  };
  const post = (route: string) =>
    request(route, { method: 'POST', originHeader: 'https://rivalspulse.com', cookieHeader: SESSION_COOKIE, body: { code: 'abcd-efgh' } });
  const get = () => request('account/dashboard', { cookieHeader: SESSION_COOKIE });

  /** Each route that runs behind the session, with a way to make its Supabase call fail. */
  const routes: {
    name: string;
    req: AccountRequest;
    unavailable: string;
    failing: (fail: () => Promise<never>) => Partial<AuthGateway>;
  }[] = [
    { name: 'link', req: post('account/link'), unavailable: 'Linking is unavailable', failing: (fail) => ({ redeemLinkCode: fail }) },
    { name: 'unlink', req: post('account/unlink'), unavailable: 'Linking is unavailable', failing: (fail) => ({ unlinkPlayer: fail }) },
    { name: 'dashboard', req: get(), unavailable: 'Your dashboard is unavailable', failing: (fail) => ({ readOwnDashboard: fail }) },
    { name: 'records setting read', req: request('account/records-opt-in', { cookieHeader: SESSION_COOKIE }), unavailable: 'Pulse Records setting is unavailable', failing: (fail) => ({ readRecordsOptIn: fail }) },
    { name: 'records setting save', req: { ...post('account/records-opt-in'), body: { show: true } }, unavailable: 'Pulse Records setting is unavailable', failing: (fail) => ({ setRecordsOptIn: fail }) },
  ];

  /** The refreshed tokens belong only in the Set-Cookie value, never in a body or a log line. */
  const expectNoTokenLeak = (response: AccountResponse, log: jasmine.Spy): void => {
    const exposed = JSON.stringify([response.body, log.calls.allArgs().map(String)]);
    expect(exposed).not.toContain(REFRESHED.accessToken);
    expect(exposed).not.toContain(REFRESHED.refreshToken);
  };

  for (const { name, req, unavailable, failing } of routes) {
    it(`keeps the new cookie on a 503 from ${name}`, async () => {
      const warn = spyOn(console, 'warn');
      const response = await run(req, refreshing(failing(down)));

      expect(response.status).toBe(503);
      expect(response.cookies.length).toBe(1);
      expect(response.cookies[0]).toContain(NEW_COOKIE);
      expect(JSON.stringify(response.body)).not.toContain('down');
      expect((response.body as { error: string }).error).toContain(unavailable);
      expectNoTokenLeak(response, warn);
    });

    it(`keeps the new cookie on a 500 from ${name}`, async () => {
      const error = spyOn(console, 'error');
      const response = await run(req, refreshing(failing(broken)));

      expect(response.status).toBe(500);
      expect(response.cookies.length).toBe(1);
      expect(response.cookies[0]).toContain(NEW_COOKIE);
      expect(JSON.stringify(response.body)).not.toContain('secret');
      expectNoTokenLeak(response, error);
    });

    it(`keeps the original sign-in time on the cookie of a failed ${name}`, async () => {
      spyOn(console, 'warn');
      const response = await run(
        { ...req, cookieHeader: signedInCookie(120) },
        refreshing(failing(down)),
      );

      expect(response.cookies[0]).toContain(`${NEW_COOKIE}~${NOW_MS / 1000 - 120};`);
    });

    it(`sets no cookie on a 503 from ${name} when nothing was refreshed`, async () => {
      spyOn(console, 'warn');
      const response = await run(req, gateway(failing(down)));

      expect(response.status).toBe(503);
      expect(response.cookies).toEqual([]);
    });
  }

  it('keeps the new cookie when the code is refused', async () => {
    const response = await run(post('account/link'), refreshing({ redeemLinkCode: async () => ({ status: 'invalid' }) }));

    expect(response.status).toBe(400);
    expect(response.cookies[0]).toContain(NEW_COOKIE);
  });

  it('keeps the new cookie when the account has made too many wrong tries', async () => {
    const response = await run(
      post('account/link'),
      refreshing({ redeemLinkCode: async () => ({ status: 'rate-limited', retryAfterSeconds: 600 }) }),
    );

    expect(response.status).toBe(429);
    expect(response.cookies[0]).toContain(NEW_COOKIE);
  });

  it('sets nothing when the refresh itself could not be made', async () => {
    spyOn(console, 'warn');
    const response = await run(get(), gateway({ resolve: down }));

    expect(response.status).toBe(503);
    expect(response.cookies).toEqual([]);
  });
});
