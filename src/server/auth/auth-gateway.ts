import type { LinkedPlayer } from '../../app/core/auth/linked-player.types.js';
import type { SessionTokens } from './auth-cookies.js';
import type { OwnDashboardLine, OwnFigureLine } from '../account/own-dashboard.js';

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

type OAuthProvider = 'discord';

export type RedeemResult =
  | { status: 'linked'; player: LinkedPlayer }
  /** Wrong, used and expired codes are not told apart. */
  | { status: 'invalid' }
  | { status: 'rate-limited'; retryAfterSeconds: number };

export type OwnDashboardRead =
  | { linked: false }
  | { linked: true; player: LinkedPlayer; truncated: boolean; lines: OwnDashboardLine[] };

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
  /**
   * Deletes the signed-in account for good, and its `profiles` row with it. Returns `not-signed-in`
   * when the session is not valid, so nobody can delete an account they do not hold a session for.
   */
  deleteAccount(tokens: SessionTokens): Promise<'deleted' | 'not-signed-in'>;
  /**
   * The player the account is linked to, or null when it is not. Never throws: a header label is not
   * worth failing a page for, so a Supabase that cannot answer reads as "not linked".
   */
  linkedPlayer(tokens: SessionTokens): Promise<LinkedPlayer | null>;
  /** Spends a canonical link code for the account the (already verified) tokens belong to. */
  redeemLinkCode(tokens: SessionTokens, code: string): Promise<RedeemResult>;
  /** Removes the account's link. Removing none is not an error. */
  unlinkPlayer(tokens: SessionTokens): Promise<void>;
  /**
   * The newest matches the account's link can prove are its own (capped by the database), or that it
   * has no link. The database decides whose lines these are; nothing here says whose to read.
   */
  readOwnDashboard(tokens: SessionTokens): Promise<OwnDashboardRead>;
}

/** Supabase could not be asked: it is not configured, unreachable, or answered with a server error. */
export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

type AuthEnv = Readonly<Record<string, string | undefined>>;

const REQUEST_TIMEOUT_MS = 5000;

/**
 * Talks to Supabase Auth and PostgREST over plain `fetch` with the publishable key and the user's own
 * token, so row-level security decides what each call may touch. The service-role key is used for one
 * call only: deleting the account, which Supabase offers to no other key.
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

  /**
   * A 4xx means the credentials were refused. A 5xx, or a 429 (Supabase limits Auth calls per IP and
   * every call comes from our few servers), means Supabase is unwell: nobody is signed out for it.
   */
  const refused = (response: Response): boolean => {
    if (response.status >= 500 || response.status === 429) {
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

  /** The user behind the tokens, refreshing an expired access token. Undefined when the session is invalid. */
  const verify = async (
    tokens: SessionTokens,
  ): Promise<{ id: string; account: Account; tokens: SessionTokens } | undefined> => {
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

    return found && { ...found, tokens: current };
  };

  /** Calls a database function as the signed-in user, so row-level security and `auth.uid()` apply. */
  const rpc = async (name: string, args: Record<string, unknown>, accessToken: string): Promise<unknown> => {
    const response = await call(
      `/rest/v1/rpc/${name}`,
      { method: 'POST', body: JSON.stringify(args) },
      accessToken,
    );

    if (!response.ok) {
      throw new AuthUnavailableError(`Supabase answered ${response.status} to ${name}`);
    }

    // A function that returns nothing answers with an empty body (204, or 200 on older PostgREST).
    const text = await response.text();

    return text ? JSON.parse(text) : undefined;
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
      const verified = await verify(tokens);

      return verified && { account: verified.account, tokens: verified.tokens };
    },

    async deleteAccount(tokens) {
      const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']?.trim();

      if (!serviceRoleKey) {
        throw new AuthUnavailableError('Account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY.');
      }

      const verified = await verify(tokens);

      if (!verified) {
        return 'not-signed-in';
      }

      const response = await call(`/auth/v1/admin/users/${encodeURIComponent(verified.id)}`, {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ should_soft_delete: false }),
      });

      // Only Supabase's own "no such user" counts as already gone; a 404 from a wrong address does not.
      if (!response.ok && !(response.status === 404 && (await errorCodeOf(response)) === 'user_not_found')) {
        throw new AuthUnavailableError(`Supabase Auth refused the account deletion with ${response.status}`);
      }

      return 'deleted';
    },

    async linkedPlayer(tokens) {
      try {
        const response = await call(
          '/rest/v1/player_links?select=player_name,avatar_url&limit=1',
          { method: 'GET' },
          tokens.accessToken,
        );

        return response.ok ? linkedPlayerOf(await response.json()) : failedLinkRead(response.status);
      } catch (error) {
        return failedLinkRead(error instanceof Error ? error.message : 'unknown error');
      }
    },

    async redeemLinkCode(tokens, code) {
      return redeemResultOf(await rpc('redeem_link_code', { p_code: code }, tokens.accessToken));
    },

    async unlinkPlayer(tokens) {
      await rpc('unlink_player', {}, tokens.accessToken);
    },

    async readOwnDashboard(tokens) {
      return dashboardReadOf(await rpc('read_own_dashboard', {}, tokens.accessToken));
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

async function errorCodeOf(response: Response): Promise<unknown> {
  try {
    return ((await response.json()) as { error_code?: unknown } | null)?.error_code;
  } catch {
    return undefined;
  }
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

function failedLinkRead(reason: string | number): null {
  console.warn('The linked player could not be read:', reason);

  return null;
}

function linkedPlayerOf(rows: unknown): LinkedPlayer | null {
  const row = Array.isArray(rows)
    ? (rows[0] as { player_name?: unknown; avatar_url?: unknown } | undefined)
    : undefined;

  return typeof row?.player_name === 'string' && row.player_name
    ? { name: row.player_name, avatarUrl: typeof row.avatar_url === 'string' && row.avatar_url ? row.avatar_url : null }
    : null;
}

function redeemResultOf(answer: unknown): RedeemResult {
  const result = answer as { status?: unknown; name?: unknown; avatarUrl?: unknown; retryAfter?: unknown } | null;

  switch (result?.status) {
    case 'linked':
      if (typeof result.name === 'string') {
        return {
          status: 'linked',
          player: { name: result.name, avatarUrl: typeof result.avatarUrl === 'string' ? result.avatarUrl : null },
        };
      }

      break;
    case 'invalid':
      return { status: 'invalid' };
    case 'rate_limited':
      return {
        status: 'rate-limited',
        retryAfterSeconds: typeof result.retryAfter === 'number' ? result.retryAfter : 60,
      };
  }

  throw new AuthUnavailableError('Supabase answered redeem_link_code with an unknown shape');
}

function dashboardReadOf(answer: unknown): OwnDashboardRead {
  const read = answer as {
    linked?: unknown;
    name?: unknown;
    avatarUrl?: unknown;
    truncated?: unknown;
    lines?: unknown;
  } | null;

  if (read?.linked === false) {
    return { linked: false };
  }

  if (read?.linked === true && typeof read.name === 'string' && Array.isArray(read.lines)) {
    return {
      linked: true,
      player: { name: read.name, avatarUrl: typeof read.avatarUrl === 'string' && read.avatarUrl ? read.avatarUrl : null },
      truncated: read.truncated === true,
      lines: read.lines.flatMap((line) => dashboardLineOf(line) ?? []),
    };
  }

  throw new AuthUnavailableError('Supabase answered read_own_dashboard with an unknown shape');
}

/** A line whose time cannot be read is dropped: it can be placed nowhere in a history. */
function dashboardLineOf(raw: unknown): OwnDashboardLine | undefined {
  const line = raw as Record<string, unknown> | null;

  if (typeof line?.['playedAt'] !== 'string' || Number.isNaN(Date.parse(line['playedAt']))) {
    return undefined;
  }

  return {
    playedAt: line['playedAt'],
    heroId: numberOrNull(line['heroId']),
    kills: numberOrNull(line['kills']),
    deaths: numberOrNull(line['deaths']),
    assists: numberOrNull(line['assists']),
    finalHits: numberOrNull(line['finalHits']),
    isWin: typeof line['isWin'] === 'boolean' ? line['isWin'] : null,
    playModeId: numberOrNull(line['playModeId']),
    mapName: typeof line['mapName'] === 'string' && line['mapName'] ? line['mapName'] : null,
    figures: Array.isArray(line['figures']) ? line['figures'].flatMap((figure) => figureOf(figure) ?? []) : [],
  };
}

function figureOf(raw: unknown): OwnFigureLine | undefined {
  const figure = raw as Record<string, unknown> | null;
  const heroId = numberOrNull(figure?.['heroId']);

  return heroId === null
    ? undefined
    : {
        heroId,
        seconds: numberOrNull(figure?.['seconds']),
        damage: numberOrNull(figure?.['damage']),
        healing: numberOrNull(figure?.['healing']),
        blocked: numberOrNull(figure?.['blocked']),
      };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
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
