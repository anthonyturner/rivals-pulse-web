/**
 * The two cookies of the account session. Both are HttpOnly (page scripts cannot read them), Secure
 * and SameSite=Lax, and only the API paths ever receive them.
 *
 * The session cookie carries the Supabase access token and refresh token. A browser drops a cookie
 * over about 4 KB without a word, so a pair that would not fit is refused here instead.
 */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  /**
   * When the player last went through the Discord sign-in, in Unix seconds. Supabase moves its own
   * `last_sign_in_at` forward on every token refresh, so it cannot say that; this does. It is absent
   * from a cookie written before it existed, which counts as not recent.
   */
  signedInAt?: number;
}

interface PkceState {
  verifier: string;
  next: string;
}

export const SESSION_COOKIE = 'rp_session';
export const PKCE_COOKIE = 'rp_pkce';

const SESSION_PATH = '/api';
const PKCE_PATH = '/api/auth';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PKCE_MAX_AGE_SECONDS = 10 * 60;
const MAX_COOKIE_BYTES = 4096;

/** Access and refresh tokens use only letters, digits, `-`, `_` and `.`, so `~` cannot occur in either. */
const TOKEN_SEPARATOR = '~';

export function serializeSessionCookie(tokens: SessionTokens): string {
  const parts = [tokens.accessToken, tokens.refreshToken];

  if (tokens.signedInAt !== undefined) {
    parts.push(String(Math.floor(tokens.signedInAt)));
  }

  return serialize(SESSION_COOKIE, parts.join(TOKEN_SEPARATOR), SESSION_PATH, SESSION_MAX_AGE_SECONDS);
}

export function clearSessionCookie(): string {
  return serialize(SESSION_COOKIE, '', SESSION_PATH, 0);
}

export function serializePkceCookie(state: PkceState): string {
  return serialize(PKCE_COOKIE, encodeURIComponent(JSON.stringify(state)), PKCE_PATH, PKCE_MAX_AGE_SECONDS);
}

export function clearPkceCookie(): string {
  return serialize(PKCE_COOKIE, '', PKCE_PATH, 0);
}

/** The signed-in tokens in a `Cookie` header, or undefined when there are none or they are malformed. */
export function readSessionTokens(cookieHeader: string | undefined): SessionTokens | undefined {
  const [accessToken, refreshToken, signedInAt, ...rest] = (readCookie(cookieHeader, SESSION_COOKIE) ?? '').split(
    TOKEN_SEPARATOR,
  );

  if (!accessToken || !refreshToken || rest.length > 0 || (signedInAt !== undefined && !/^\d{1,12}$/.test(signedInAt))) {
    return undefined;
  }

  return signedInAt === undefined ? { accessToken, refreshToken } : { accessToken, refreshToken, signedInAt: Number(signedInAt) };
}

export function readPkceState(cookieHeader: string | undefined): PkceState | undefined {
  const raw = readCookie(cookieHeader, PKCE_COOKIE);

  if (!raw) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw));
    const state = value as Partial<PkceState> | null;

    return typeof state?.verifier === 'string' && typeof state.next === 'string' && state.verifier
      ? { verifier: state.verifier, next: state.next }
      : undefined;
  } catch {
    // A cookie that is not our JSON is treated as absent; the flow simply starts over.
    return undefined;
  }
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  for (const part of (cookieHeader ?? '').split(';')) {
    const separator = part.indexOf('=');

    if (separator > 0 && part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }

  return undefined;
}

function serialize(name: string, value: string, path: string, maxAgeSeconds: number): string {
  const cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}; Path=${path}; HttpOnly; Secure; SameSite=Lax`;

  if (cookie.length > MAX_COOKIE_BYTES) {
    throw new Error(`The ${name} cookie would be ${cookie.length} bytes, over the ${MAX_COOKIE_BYTES}-byte limit`);
  }

  return cookie;
}
