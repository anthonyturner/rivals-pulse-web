import type { SessionTokens } from './auth-cookies.js';

/** What the account page shows. It never carries the user's id. */
export interface Account {
  email: string | null;
  provider: string;
  createdAt: string;
}

export interface ResolvedSession {
  account: Account;
  /** The tokens to keep. They differ from the ones passed in when the access token had expired. */
  tokens: SessionTokens;
}

export type OAuthProvider = 'discord';

/**
 * Everything the account routes need from Supabase Auth, so the routes can be tested without a
 * network and without `@supabase/supabase-js`, which must stay out of the browser bundle.
 */
export interface AuthGateway {
  /** The address to send the browser to, and the PKCE verifier that must come back with the code. */
  authorizeUrl(provider: OAuthProvider, redirectTo: string): Promise<{ url: string; verifier: string }>;
  /**
   * The tokens for a sign-in code, or undefined when Supabase refuses the code. A first sign-in also
   * creates the account's `profiles` row.
   */
  exchangeCode(code: string, verifier: string): Promise<SessionTokens | undefined>;
  /** The signed-in account, refreshing an expired access token, or undefined when the session is invalid. */
  resolve(tokens: SessionTokens): Promise<ResolvedSession | undefined>;
  /** Ends this session at Supabase. Never throws: the caller clears its cookie either way. */
  signOut(tokens: SessionTokens): Promise<void>;
}

/** Supabase could not be asked: it is not configured, unreachable, or answered with a server error. */
export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

export type AuthEnv = Readonly<Record<string, string | undefined>>;

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Talks to Supabase Auth and PostgREST over plain `fetch` with the publishable key and the user's own
 * token, so row-level security decides what each call may touch. The service-role key is not used.
 * PKCE (a one-time secret that proves the browser finishing a sign-in is the one that started it) is
 * done by hand, because the library keeps its secret in browser storage.
 */
export function createSupabaseAuthGateway(env: AuthEnv, fetcher: typeof fetch = fetch): AuthGateway {
  const baseUrl = env['SUPABASE_URL']?.trim().replace(/\/+$/, '');
  const publishableKey = env['SUPABASE_PUBLISHABLE_KEY']?.trim();

  if (!baseUrl || !publishableKey) {
    throw new AuthUnavailableError('Sign-in is not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.');
  }

  const call = async (path: string, init: RequestInit, accessToken?: string): Promise<Response> => {
    try {
      return await fetcher(`${baseUrl}${path}`, {
        ...init,
        headers: {
          apikey: publishableKey,
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new AuthUnavailableError('Supabase Auth could not be reached');
    }
  };

  /** A 4xx means the credentials were refused; a 5xx means Supabase is unwell. */
  const refused = (response: Response): boolean => {
    if (response.status >= 500) {
      throw new AuthUnavailableError(`Supabase Auth answered ${response.status}`);
    }

    return !response.ok;
  };

  const refresh = async (refreshToken: string): Promise<{ tokens: SessionTokens; user: unknown } | undefined> => {
    const response = await call('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (refused(response)) {
      return undefined;
    }

    const body = (await response.json()) as Record<string, unknown>;
    const tokens = tokensOf(body);

    return tokens ? { tokens, user: body['user'] } : undefined;
  };

  const ensureProfile = async (userId: string, accessToken: string): Promise<void> => {
    try {
      const response = await call(
        '/rest/v1/profiles?on_conflict=user_id',
        {
          method: 'POST',
          headers: { prefer: 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: userId }),
        },
        accessToken,
      );

      if (!response.ok) {
        console.warn(`The profile row could not be created (status ${response.status})`);
      }
    } catch (error) {
      // The account page does not need the row yet, so a failure here must not sign anyone out.
      console.warn('The profile row could not be created', error instanceof Error ? error.message : error);
    }
  };

  return {
    async authorizeUrl(provider, redirectTo) {
      const verifier = randomToken();
      const params = new URLSearchParams({
        provider,
        redirect_to: redirectTo,
        code_challenge: await challengeFor(verifier),
        code_challenge_method: 's256',
      });

      return { url: `${baseUrl}/auth/v1/authorize?${params}`, verifier };
    },

    async exchangeCode(code, verifier) {
      const response = await call('/auth/v1/token?grant_type=pkce', {
        method: 'POST',
        body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
      });

      if (refused(response)) {
        return undefined;
      }

      const body = (await response.json()) as Record<string, unknown>;
      const tokens = tokensOf(body);
      const found = accountOf(body['user']);

      if (tokens && found) {
        await ensureProfile(found.id, tokens.accessToken);
      }

      return tokens;
    },

    async resolve(tokens) {
      let current = tokens;
      const userResponse = await call('/auth/v1/user', { method: 'GET' }, current.accessToken);
      let user: unknown;

      if (refused(userResponse)) {
        const refreshed = await refresh(current.refreshToken);

        if (!refreshed) {
          return undefined;
        }

        current = refreshed.tokens;
        user = refreshed.user;
      } else {
        user = await userResponse.json();
      }

      const found = accountOf(user);

      if (!found) {
        return undefined;
      }

      return { account: found.account, tokens: current };
    },

    async signOut(tokens) {
      try {
        await call('/auth/v1/logout?scope=local', { method: 'POST' }, tokens.accessToken);
      } catch (error) {
        console.warn('Supabase sign-out failed', error instanceof Error ? error.message : error);
      }
    },
  };
}

function tokensOf(body: Record<string, unknown>): SessionTokens | undefined {
  const accessToken = body['access_token'];
  const refreshToken = body['refresh_token'];

  return typeof accessToken === 'string' && typeof refreshToken === 'string' && accessToken && refreshToken
    ? { accessToken, refreshToken }
    : undefined;
}

function accountOf(user: unknown): { id: string; account: Account } | undefined {
  const record = user as {
    id?: unknown;
    email?: unknown;
    created_at?: unknown;
    app_metadata?: { provider?: unknown };
  } | null;

  if (typeof record?.id !== 'string' || typeof record.created_at !== 'string') {
    return undefined;
  }

  return {
    id: record.id,
    account: {
      email: typeof record.email === 'string' && record.email ? record.email : null,
      provider: typeof record.app_metadata?.provider === 'string' ? record.app_metadata.provider : 'unknown',
      createdAt: record.created_at,
    },
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** 48 random bytes, which is 64 characters and inside the 43 to 128 that PKCE allows. */
function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(48)));
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

  return base64Url(new Uint8Array(digest));
}
