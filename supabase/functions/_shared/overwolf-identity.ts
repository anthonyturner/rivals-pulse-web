/**
 * Confirms an Overwolf session token (`overwolf.profile.generateUserSessionToken`) with Overwolf's
 * documented verify endpoint; the token is signed with Overwolf's key, so it cannot be checked here.
 * Only the 401 for a bad token has been exercised live, not the 200 for a valid one.
 */

const VERIFY_URL = 'https://accounts.overwolf.com/tokens/short-lived/verify';
const VERIFY_TIMEOUT_MS = 5_000;

/** A failure to identify the caller, carrying the HTTP status the function should answer with. */
export class IdentityError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'IdentityError';
    this.status = status;
  }
}

/**
 * The username inside a session token, or `null` when the token is not a well-formed, unexpired JWT.
 * Decoding is not verifying: the result is only trusted after Overwolf has accepted the token.
 */
function readUnverifiedClaims(token: string, nowSeconds: number): { sub: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof claims.sub !== 'string' || !claims.sub.trim()) return null;
    if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) return null;
    return { sub: claims.sub.trim() };
  } catch {
    return null;
  }
}

/**
 * Confirms `token` with Overwolf and returns the Overwolf username it belongs to.
 *
 * Fails closed: a missing, malformed, expired or rejected token is a 401, and an Overwolf outage
 * is a 503, so a write is never accepted on an identity nobody confirmed.
 */
export async function verifyOverwolfSession(
  token: string | null | undefined,
  extensionId: string,
  options: { fetchImpl?: typeof fetch; nowMs?: number } = {},
): Promise<{ username: string }> {
  const { fetchImpl = fetch, nowMs = Date.now() } = options;
  const trimmed = token?.trim();
  if (!trimmed) throw new IdentityError(401, 'An Overwolf session token is required');

  const claims = readUnverifiedClaims(trimmed, nowMs / 1000);
  if (!claims) throw new IdentityError(401, 'The Overwolf session token is invalid or expired');

  let response: Response;
  try {
    response = await fetchImpl(`${VERIFY_URL}?extensionId=${encodeURIComponent(extensionId)}`, {
      headers: { Authorization: `Bearer ${trimmed}` },
      redirect: 'error',
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });
  } catch {
    throw new IdentityError(503, 'Overwolf could not be reached to verify the session');
  }

  if (response.status === 401) throw new IdentityError(401, 'Overwolf rejected the session token');
  if (response.status !== 200) throw new IdentityError(503, 'Overwolf could not verify the session');

  const body = await response.json().catch(() => null) as { username?: unknown } | null;
  const username = typeof body?.username === 'string' && body.username.trim() ? body.username.trim() : claims.sub;
  return { username };
}

/**
 * A stable, non-reversible stand-in for an Overwolf username (HMAC-SHA-256, hex).
 *
 * Stored in place of the username so a leaked table does not name the people who play, while the
 * same user still maps to the same value for rate limiting. Keyed with a server-only secret so
 * the usernames cannot be recovered by hashing a list of guesses. Rotating the secret starts a
 * fresh identity for everyone, which only resets their rate-limit history.
 */
export async function recorderId(username: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(username.toLowerCase()));
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}
