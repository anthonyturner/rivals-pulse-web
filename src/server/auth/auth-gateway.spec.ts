import { AuthUnavailableError, createSupabaseAuthGateway } from './auth-gateway';

const ENV = { SUPABASE_URL: 'https://project.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' };
const USER = {
  id: 'user-1',
  email: 'player@example.com',
  created_at: '2026-11-01T10:00:00Z',
  app_metadata: { provider: 'discord' },
};

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** A fetch that records each call and answers from `answer`, keyed by the path after the host. */
function fakeFetch(answer: (call: Call) => { status: number; body?: unknown }) {
  const calls: Call[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: init?.headers as Record<string, string>,
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };

    calls.push(call);

    const { status, body } = answer(call);

    return new Response(body === undefined ? null : JSON.stringify(body), { status });
  }) as typeof fetch;

  return { fetcher, calls };
}

describe('createSupabaseAuthGateway', () => {
  it('refuses to start without the Supabase address and publishable key', () => {
    expect(() => createSupabaseAuthGateway({})).toThrowMatching((error) => error instanceof AuthUnavailableError);
  });

  describe('authorizeUrl', () => {
    it('builds a PKCE sign-in address whose challenge is the hash of the returned verifier', async () => {
      const { fetcher, calls } = fakeFetch(() => ({ status: 500 }));
      const gateway = createSupabaseAuthGateway(ENV, fetcher);

      const { url, verifier } = await gateway.authorizeUrl('discord', 'https://rivalspulse.com/api/auth/callback');
      const query = new URL(url).searchParams;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      expect(url.startsWith('https://project.supabase.co/auth/v1/authorize?')).toBeTrue();
      expect(query.get('provider')).toBe('discord');
      expect(query.get('redirect_to')).toBe('https://rivalspulse.com/api/auth/callback');
      expect(query.get('code_challenge_method')).toBe('s256');
      expect(query.get('code_challenge')).toBe(expected);
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(url).not.toContain(verifier);
      expect(calls).toEqual([]);
    });
  });

  describe('exchangeCode', () => {
    it('trades the code and verifier for tokens and creates the profile row as the user', async () => {
      const { fetcher, calls } = fakeFetch((call) =>
        call.url.includes('/auth/v1/token')
          ? { status: 200, body: { access_token: 'access', refresh_token: 'refresh', user: USER } }
          : { status: 201 },
      );

      const tokens = await createSupabaseAuthGateway(ENV, fetcher).exchangeCode('the-code', 'the-verifier');

      expect(tokens).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
      expect(calls[0].url).toBe('https://project.supabase.co/auth/v1/token?grant_type=pkce');
      expect(calls[0].body).toEqual({ auth_code: 'the-code', code_verifier: 'the-verifier' });
      expect(calls[0].headers['apikey']).toBe('sb_publishable_test');
      expect(calls[1].url).toBe('https://project.supabase.co/rest/v1/profiles?on_conflict=user_id');
      expect(calls[1].body).toEqual({ user_id: 'user-1' });
      expect(calls[1].headers['authorization']).toBe('Bearer access');
      expect(calls[1].headers['prefer']).toContain('ignore-duplicates');
    });

    it('still signs the visitor in when the profile row cannot be created', async () => {
      spyOn(console, 'warn');
      const { fetcher } = fakeFetch((call) =>
        call.url.includes('/auth/v1/token')
          ? { status: 200, body: { access_token: 'access', refresh_token: 'refresh', user: USER } }
          : { status: 404 },
      );

      expect(await createSupabaseAuthGateway(ENV, fetcher).exchangeCode('c', 'v')).toEqual({
        accessToken: 'access',
        refreshToken: 'refresh',
      });
    });

    it('returns nothing when Supabase refuses the code', async () => {
      const { fetcher } = fakeFetch(() => ({ status: 400, body: { error: 'invalid_grant' } }));

      expect(await createSupabaseAuthGateway(ENV, fetcher).exchangeCode('c', 'v')).toBeUndefined();
    });

    it('reports Supabase being down as unavailable, not as a refused code', async () => {
      const { fetcher } = fakeFetch(() => ({ status: 503 }));

      await expectAsync(createSupabaseAuthGateway(ENV, fetcher).exchangeCode('c', 'v')).toBeRejectedWithError(
        AuthUnavailableError,
      );
    });
  });

  describe('resolve', () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };

    it('returns the account for a valid access token and uses the publishable key plus the user token', async () => {
      const { fetcher, calls } = fakeFetch(() => ({ status: 200, body: USER }));

      const resolved = await createSupabaseAuthGateway(ENV, fetcher).resolve(tokens);

      expect(resolved).toEqual({
        account: { email: 'player@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' },
        tokens,
      });
      expect(calls.length).toBe(1);
      expect(calls[0].headers['authorization']).toBe('Bearer access');
      expect(JSON.stringify(resolved)).not.toContain('user-1');
    });

    it('refreshes an expired access token and returns the new pair', async () => {
      const { fetcher, calls } = fakeFetch((call) =>
        call.url.includes('/auth/v1/user')
          ? { status: 401, body: { msg: 'expired' } }
          : { status: 200, body: { access_token: 'new-access', refresh_token: 'new-refresh', user: USER } },
      );

      const resolved = await createSupabaseAuthGateway(ENV, fetcher).resolve(tokens);

      expect(resolved?.tokens).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
      expect(calls[1].url).toBe('https://project.supabase.co/auth/v1/token?grant_type=refresh_token');
      expect(calls[1].body).toEqual({ refresh_token: 'refresh' });
    });

    it('keeps the visitor signed in when Supabase rate-limits the call', async () => {
      const { fetcher } = fakeFetch(() => ({ status: 429 }));

      await expectAsync(createSupabaseAuthGateway(ENV, fetcher).resolve(tokens)).toBeRejectedWithError(
        AuthUnavailableError,
      );
    });

    it('returns nothing when the refresh token is refused too', async () => {
      const { fetcher } = fakeFetch(() => ({ status: 401 }));

      expect(await createSupabaseAuthGateway(ENV, fetcher).resolve(tokens)).toBeUndefined();
    });

    it('reports an unreachable Supabase as unavailable', async () => {
      const fetcher = (async () => {
        throw new TypeError('network down');
      }) as typeof fetch;

      await expectAsync(createSupabaseAuthGateway(ENV, fetcher).resolve(tokens)).toBeRejectedWithError(
        AuthUnavailableError,
      );
    });
  });

  describe('linkedPlayer', () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };

    it('reads the account\'s link with the user token, so row-level security picks the row', async () => {
      const { fetcher, calls } = fakeFetch(() => ({
        status: 200,
        body: [{ player_name: 'Aurora', avatar_url: 'https://content.overwolf.com/a.png' }],
      }));

      const player = await createSupabaseAuthGateway(ENV, fetcher).linkedPlayer(tokens);

      expect(player).toEqual({ name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' });
      expect(calls[0].url).toBe('https://project.supabase.co/rest/v1/player_links?select=player_name,avatar_url&limit=1');
      expect(calls[0].headers['authorization']).toBe('Bearer access');
      expect(calls[0].headers['apikey']).toBe('sb_publishable_test');
    });

    it('has no avatar when the row holds none', async () => {
      const { fetcher } = fakeFetch(() => ({ status: 200, body: [{ player_name: 'Aurora', avatar_url: null }] }));

      expect(await createSupabaseAuthGateway(ENV, fetcher).linkedPlayer(tokens)).toEqual({
        name: 'Aurora',
        avatarUrl: null,
      });
    });

    it('is null for an account with no link', async () => {
      const { fetcher } = fakeFetch(() => ({ status: 200, body: [] }));

      expect(await createSupabaseAuthGateway(ENV, fetcher).linkedPlayer(tokens)).toBeNull();
    });

    it('is null, and does not throw, when the table is not there yet or Supabase is down', async () => {
      spyOn(console, 'warn');
      const missing = fakeFetch(() => ({ status: 404, body: { code: 'PGRST205' } }));
      const offline = (async () => {
        throw new TypeError('offline');
      }) as typeof fetch;

      expect(await createSupabaseAuthGateway(ENV, missing.fetcher).linkedPlayer(tokens)).toBeNull();
      expect(await createSupabaseAuthGateway(ENV, offline).linkedPlayer(tokens)).toBeNull();
    });
  });

  describe('redeemLinkCode', () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    const redeem = (answer: { status: number; body?: unknown }) => {
      const { fetcher, calls } = fakeFetch(() => answer);

      return { calls, result: createSupabaseAuthGateway(ENV, fetcher).redeemLinkCode(tokens, 'ABCDEFGH') };
    };

    it('calls the redeem function with the code and the user token', async () => {
      const { calls, result } = redeem({
        status: 200,
        body: { status: 'linked', name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' },
      });

      expect(await result).toEqual({
        status: 'linked',
        player: { name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' },
      });
      expect(calls[0].url).toBe('https://project.supabase.co/rest/v1/rpc/redeem_link_code');
      expect(calls[0].method).toBe('POST');
      expect(calls[0].body).toEqual({ p_code: 'ABCDEFGH' });
      expect(calls[0].headers['authorization']).toBe('Bearer access');
    });

    it('reads an invalid code', async () => {
      expect(await redeem({ status: 200, body: { status: 'invalid' } }).result).toEqual({ status: 'invalid' });
    });

    it('reads a rate limit', async () => {
      expect(await redeem({ status: 200, body: { status: 'rate_limited', retryAfter: 540 } }).result).toEqual({
        status: 'rate-limited',
        retryAfterSeconds: 540,
      });
    });

    it('reports a missing function, a refusal or an answer of an unknown shape as unavailable', async () => {
      for (const answer of [
        { status: 404, body: { code: 'PGRST202' } },
        { status: 401 },
        { status: 500 },
        { status: 200, body: { status: 'surprise' } },
        { status: 200, body: { status: 'linked' } },
      ]) {
        await expectAsync(redeem(answer).result).toBeRejectedWithError(AuthUnavailableError);
      }
    });
  });

  describe('unlinkPlayer', () => {
    it('calls the unlink function with the user token', async () => {
      const { fetcher, calls } = fakeFetch(() => ({ status: 204 }));

      await createSupabaseAuthGateway(ENV, fetcher).unlinkPlayer({ accessToken: 'access', refreshToken: 'refresh' });

      expect(calls[0].url).toBe('https://project.supabase.co/rest/v1/rpc/unlink_player');
      expect(calls[0].method).toBe('POST');
      expect(calls[0].headers['authorization']).toBe('Bearer access');
    });

    it('reports a refusal as unavailable, so the link is not shown as removed', async () => {
      const { fetcher } = fakeFetch(() => ({ status: 500 }));

      await expectAsync(
        createSupabaseAuthGateway(ENV, fetcher).unlinkPlayer({ accessToken: 'a', refreshToken: 'r' }),
      ).toBeRejectedWithError(AuthUnavailableError);
    });
  });

  describe('isAdmin', () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    const ask = (answer: { status: number; body?: unknown }) => {
      const { fetcher, calls } = fakeFetch(() => answer);

      return { calls, result: createSupabaseAuthGateway(ENV, fetcher).isAdmin(tokens) };
    };

    it('asks the database function with the publishable key and the user token, and passes nothing to say who', async () => {
      const { calls, result } = ask({ status: 200, body: true });

      expect(await result).toBeTrue();
      expect(calls[0].url).toBe('https://project.supabase.co/rest/v1/rpc/is_admin');
      expect(calls[0].method).toBe('POST');
      expect(calls[0].body).toEqual({});
      expect(calls[0].headers['authorization']).toBe('Bearer access');
      expect(calls[0].headers['apikey']).toBe('sb_publishable_test');
    });

    it('is false when the database says so', async () => {
      expect(await ask({ status: 200, body: false }).result).toBeFalse();
    });

    it('reports a missing function, a refusal or an answer that is not true or false as unavailable, never as false', async () => {
      for (const answer of [{ status: 404 }, { status: 401 }, { status: 500 }, { status: 200, body: 'yes' }, { status: 204 }]) {
        await expectAsync(ask(answer).result).toBeRejectedWithError(AuthUnavailableError);
      }
    });
  });

  describe('readOwnDashboard', () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    const read = (answer: { status: number; body?: unknown }) => {
      const { fetcher, calls } = fakeFetch(() => answer);

      return { calls, result: createSupabaseAuthGateway(ENV, fetcher).readOwnDashboard(tokens) };
    };
    const FULL_LINE = {
      playedAt: '2026-10-30T20:00:00+00:00',
      heroId: 1011,
      kills: 12,
      deaths: 4,
      assists: 6,
      finalHits: 3,
      isWin: true,
      playModeId: 1,
      mapName: 'Tokyo 2099',
      figures: [{ heroId: 1011, seconds: 600, damage: 9000, healing: null, blocked: 0 }],
    };

    it('calls the read function with no arguments and the user token, so the database picks the lines', async () => {
      const { calls, result } = read({ status: 200, body: { linked: false } });

      expect(await result).toEqual({ linked: false });
      expect(calls[0].url).toBe('https://project.supabase.co/rest/v1/rpc/read_own_dashboard');
      expect(calls[0].method).toBe('POST');
      expect(calls[0].body).toEqual({});
      expect(calls[0].headers['authorization']).toBe('Bearer access');
      expect(calls[0].headers['apikey']).toBe('sb_publishable_test');
    });

    it('reads the player and the lines', async () => {
      const { result } = read({
        status: 200,
        body: {
          linked: true,
          name: 'Aurora',
          avatarUrl: 'https://content.overwolf.com/a.png',
          truncated: true,
          lines: [FULL_LINE],
        },
      });

      expect(await result).toEqual({
        linked: true,
        player: { name: 'Aurora', avatarUrl: 'https://content.overwolf.com/a.png' },
        truncated: true,
        lines: [FULL_LINE],
      });
    });

    it('keeps a blank as null and never as 0', async () => {
      const { result } = read({
        status: 200,
        body: {
          linked: true,
          name: 'Aurora',
          avatarUrl: null,
          truncated: false,
          lines: [
            {
              playedAt: '2026-10-30T20:00:00+00:00',
              heroId: null,
              kills: null,
              deaths: 'many',
              assists: null,
              finalHits: null,
              isWin: null,
              playModeId: null,
              mapName: '',
              figures: [{ heroId: 1011, seconds: null, damage: null, healing: null, blocked: null }],
            },
          ],
        },
      });
      const answer = await result;

      expect(answer.linked && answer.player.avatarUrl).toBeNull();
      expect(answer.linked && answer.lines[0]).toEqual({
        playedAt: '2026-10-30T20:00:00+00:00',
        heroId: null,
        kills: null,
        deaths: null,
        assists: null,
        finalHits: null,
        isWin: null,
        playModeId: null,
        mapName: null,
        figures: [{ heroId: 1011, seconds: null, damage: null, healing: null, blocked: null }],
      });
    });

    it('drops a line whose time cannot be read, and a figure with no hero', async () => {
      const { result } = read({
        status: 200,
        body: {
          linked: true,
          name: 'Aurora',
          truncated: false,
          lines: [
            { ...FULL_LINE, playedAt: 'yesterday' },
            { ...FULL_LINE, playedAt: undefined },
            null,
            { ...FULL_LINE, figures: [{ seconds: 60 }, ...FULL_LINE.figures] },
          ],
        },
      });
      const answer = await result;

      expect(answer.linked && answer.lines.length).toBe(1);
      expect(answer.linked && answer.lines[0].figures).toEqual(FULL_LINE.figures);
    });

    it('reports a missing function, a refusal or an answer of an unknown shape as unavailable', async () => {
      for (const answer of [
        { status: 404, body: { code: 'PGRST202' } },
        { status: 401 },
        { status: 403, body: { code: '42501' } },
        { status: 500 },
        { status: 200 },
        { status: 200, body: { linked: 'maybe' } },
        { status: 200, body: { linked: true, lines: [] } },
        { status: 200, body: { linked: true, name: 'Aurora', lines: 'none' } },
      ]) {
        await expectAsync(read(answer).result).toBeRejectedWithError(AuthUnavailableError);
      }
    });
  });

  describe('signOut', () => {
    it('ends only this session and never throws', async () => {
      const { fetcher, calls } = fakeFetch(() => ({ status: 204 }));

      await createSupabaseAuthGateway(ENV, fetcher).signOut({ accessToken: 'access', refreshToken: 'refresh' });

      expect(calls[0].url).toBe('https://project.supabase.co/auth/v1/logout?scope=local');
      expect(calls[0].method).toBe('POST');

      spyOn(console, 'warn');
      const failing = (async () => {
        throw new TypeError('offline');
      }) as typeof fetch;

      await expectAsync(
        createSupabaseAuthGateway(ENV, failing).signOut({ accessToken: 'a', refreshToken: 'r' }),
      ).toBeResolved();
    });
  });

  describe('deleteAccount', () => {
    const tokens = { accessToken: 'access', refreshToken: 'refresh' };
    const ENV_WITH_SERVICE_KEY = { ...ENV, SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test' };
    const deletion = (calls: Call[]): Call | undefined => calls.find((call) => call.method === 'DELETE');

    it('verifies the user, then deletes that user for good with the service-role key', async () => {
      const { fetcher, calls } = fakeFetch((call) =>
        call.method === 'DELETE' ? { status: 200, body: {} } : { status: 200, body: USER },
      );

      const result = await createSupabaseAuthGateway(ENV_WITH_SERVICE_KEY, fetcher).deleteAccount(tokens);

      expect(result).toBe('deleted');
      expect(calls[0].url).toBe('https://project.supabase.co/auth/v1/user');
      expect(calls[0].headers['authorization']).toBe('Bearer access');
      expect(calls[0].headers['apikey']).toBe('sb_publishable_test');
      expect(calls[1].url).toBe('https://project.supabase.co/auth/v1/admin/users/user-1');
      expect(calls[1].headers['authorization']).toBe('Bearer sb_secret_test');
      expect(calls[1].headers['apikey']).toBe('sb_secret_test');
      expect(calls[1].body).toEqual({ should_soft_delete: false });
    });

    it('uses the service-role key for the deletion and nothing else', async () => {
      const { fetcher, calls } = fakeFetch((call) =>
        call.method === 'DELETE' ? { status: 200, body: {} } : { status: 200, body: USER },
      );
      const gateway = createSupabaseAuthGateway(ENV_WITH_SERVICE_KEY, fetcher);

      await gateway.resolve(tokens);
      await gateway.signOut(tokens);
      await gateway.deleteAccount(tokens);

      const usingServiceKey = calls.filter((call) => JSON.stringify(call.headers).includes('sb_secret_test'));

      expect(usingServiceKey).toEqual([deletion(calls) as Call]);
    });

    it('deletes the refreshed user when the access token had expired', async () => {
      const { fetcher, calls } = fakeFetch((call) => {
        if (call.method === 'DELETE') {
          return { status: 200 };
        }

        return call.url.includes('/auth/v1/user')
          ? { status: 401 }
          : { status: 200, body: { access_token: 'new-access', refresh_token: 'new-refresh', user: USER } };
      });

      expect(await createSupabaseAuthGateway(ENV_WITH_SERVICE_KEY, fetcher).deleteAccount(tokens)).toBe('deleted');
      expect(deletion(calls)?.url).toBe('https://project.supabase.co/auth/v1/admin/users/user-1');
    });

    it('deletes nothing when the session is not valid', async () => {
      const { fetcher, calls } = fakeFetch(() => ({ status: 401 }));

      expect(await createSupabaseAuthGateway(ENV_WITH_SERVICE_KEY, fetcher).deleteAccount(tokens)).toBe(
        'not-signed-in',
      );
      expect(deletion(calls)).toBeUndefined();
    });

    it('counts an account that is already gone as deleted', async () => {
      const { fetcher } = fakeFetch((call) =>
        call.method === 'DELETE' ? { status: 404, body: { error_code: 'user_not_found' } } : { status: 200, body: USER },
      );

      expect(await createSupabaseAuthGateway(ENV_WITH_SERVICE_KEY, fetcher).deleteAccount(tokens)).toBe('deleted');
    });

    it('does not count a 404 from the wrong address as a deletion', async () => {
      const { fetcher } = fakeFetch((call) => (call.method === 'DELETE' ? { status: 404 } : { status: 200, body: USER }));

      await expectAsync(
        createSupabaseAuthGateway(ENV_WITH_SERVICE_KEY, fetcher).deleteAccount(tokens),
      ).toBeRejectedWithError(AuthUnavailableError);
    });

    it('reports a refused or failed deletion as unavailable, without leaking the key', async () => {
      const { fetcher } = fakeFetch((call) => (call.method === 'DELETE' ? { status: 401 } : { status: 200, body: USER }));

      const failure = await createSupabaseAuthGateway(ENV_WITH_SERVICE_KEY, fetcher)
        .deleteAccount(tokens)
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(AuthUnavailableError);
      expect((failure as Error).message).not.toContain('sb_secret_test');
    });

    it('is unavailable, before asking Supabase anything, when the service-role key is not set', async () => {
      const { fetcher, calls } = fakeFetch(() => ({ status: 200, body: USER }));

      await expectAsync(createSupabaseAuthGateway(ENV, fetcher).deleteAccount(tokens)).toBeRejectedWithError(
        AuthUnavailableError,
        /SUPABASE_SERVICE_ROLE_KEY/,
      );
      expect(calls).toEqual([]);
    });
  });
});
