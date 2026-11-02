import {
  clearPkceCookie,
  clearSessionCookie,
  readPkceState,
  readSessionTokens,
  serializePkceCookie,
  serializeSessionCookie,
  type SessionTokens,
} from './auth-cookies.js';
import { AuthUnavailableError, type AuthGateway } from './auth-gateway.js';
import { normalizeLinkCode } from './link-code.js';
import { deriveOwnDashboard } from './own-dashboard.js';
import {
  DELETION_MODES,
  isDeletionConfirmed,
  type DeleteAccountRequest,
} from './app/core/auth/account-deletion.types.js';
import type { OwnDashboardResponse } from './app/core/auth/own-dashboard.types.js';

/**
 * A request as the account routes see it, free of any server framework: Express and the Vercel
 * function both turn theirs into this (`account-http.ts`), so the rules below are written once.
 */
export interface AccountRequest {
  method: string;
  /** The path after `/api/`, such as `auth/session`. */
  route: string;
  query: URLSearchParams;
  cookieHeader?: string;
  originHeader?: string;
  /** The JSON body of a POST, already parsed. Undefined when there was none or it was not JSON. */
  body?: unknown;
  /** The time of the request in milliseconds; the adapter leaves it out and the routes read the clock. */
  nowMs?: number;
  /** The host the visitor used, with any port. */
  host: string;
  /** `http` or `https`, from the proxy when there is one. */
  protocol?: string;
}

export interface AccountResponse {
  status: number;
  body?: unknown;
  /** A redirect target. Always a path on this site or the sign-in address Supabase gave us. */
  location?: string;
  cookies: string[];
}

/** Sign-in is open on the live site and on a developer's machine only; a preview gets none. */
const SIGN_IN_HOSTNAMES: readonly string[] = ['rivalspulse.com', 'localhost'];
const DEFAULT_NEXT = '/account';
const MAX_NEXT_LENGTH = 200;
const NEXT_BASE = new URL('https://site.invalid');
/** How recently the player must have signed in to delete an account (ADR-0004, decision 7). */
const RECENT_SIGN_IN_SECONDS = 10 * 60;
/** One message for a wrong, used or expired code, so the answer never says which one it was. */
const LINK_CODE_REFUSED = 'That code is wrong or has expired. Get a new one from the desktop app.';
const LINK_UNAVAILABLE = 'Linking is unavailable right now. Try again in a moment.';
const DASHBOARD_UNAVAILABLE = 'Your dashboard is unavailable right now. Try again in a moment.';
const DELETE_FAILED = 'The deletion did not go through, as far as we can tell. Try again in a moment.';

export async function handleAccountRequest(
  request: AccountRequest,
  getGateway: () => AuthGateway,
): Promise<AccountResponse> {
  try {
    return await route(request, getGateway);
  } catch (error) {
    if (error instanceof AuthUnavailableError) {
      console.warn('Account request failed:', error.message);

      return json(503, { error: 'Sign-in is unavailable right now. Try again in a moment.' });
    }

    console.error('Account request failed', error);

    return json(500, { error: 'Something went wrong.' });
  }
}

async function route(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const { method, route: path } = request;

  if (method !== 'GET' && !isSameOrigin(request)) {
    return json(403, { error: 'Cross-site request refused.' });
  }

  switch (path) {
    case 'auth/session':
      return method === 'GET' ? readSession(request, gateway) : methodNotAllowed();
    case 'auth/discord/start':
      return method === 'GET' ? startDiscord(request, gateway) : methodNotAllowed();
    case 'auth/callback':
      return method === 'GET' ? finishDiscord(request, gateway) : methodNotAllowed();
    case 'auth/sign-out':
      return method === 'POST' ? signOut(request, gateway) : methodNotAllowed();
    case 'account/delete':
      return method === 'POST' ? deleteAccount(request, gateway) : methodNotAllowed();
    case 'account/link':
      return method === 'POST' ? linkPlayer(request, gateway) : methodNotAllowed();
    case 'account/unlink':
      return method === 'POST' ? unlinkPlayer(request, gateway) : methodNotAllowed();
    case 'account/dashboard':
      return method === 'GET' ? readDashboard(request, gateway) : methodNotAllowed();
    default:
      return json(404, { error: 'API route not found' });
  }
}

async function readSession(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const tokens = readSessionTokens(request.cookieHeader);

  if (!tokens) {
    return json(200, { signedIn: false });
  }

  const resolved = await gateway().resolve(tokens);

  if (!resolved) {
    return { ...json(200, { signedIn: false }), cookies: [clearSessionCookie()] };
  }

  return {
    ...json(200, {
      signedIn: true,
      account: resolved.account,
      player: await gateway().linkedPlayer(resolved.tokens),
    }),
    cookies: refreshedCookies(tokens, resolved.tokens),
  };
}

/** The cookie to set when Supabase handed back new tokens, keeping the original sign-in time. */
function refreshedCookies(original: SessionTokens, current: SessionTokens): string[] {
  const refreshed = current.accessToken !== original.accessToken || current.refreshToken !== original.refreshToken;

  return refreshed ? [serializeSessionCookie({ ...current, signedInAt: original.signedInAt })] : [];
}

/**
 * Runs `act` for a signed-in visitor, with tokens Supabase has just confirmed (refreshed if they had
 * expired, in which case the new cookie rides on the answer). Linking and the dashboard are
 * conveniences, so a Supabase that cannot be reached is a 503 here and never signs anyone out.
 */
async function withSession(
  request: AccountRequest,
  gateway: () => AuthGateway,
  { signedOutMessage, unavailableMessage }: { signedOutMessage: string; unavailableMessage: string },
  act: (tokens: SessionTokens) => Promise<AccountResponse>,
): Promise<AccountResponse> {
  const tokens = readSessionTokens(request.cookieHeader);

  if (!tokens) {
    return json(401, { error: signedOutMessage });
  }

  try {
    const resolved = await gateway().resolve(tokens);

    if (!resolved) {
      return { ...json(401, { error: signedOutMessage }), cookies: [clearSessionCookie()] };
    }

    const response = await act(resolved.tokens);

    return { ...response, cookies: [...response.cookies, ...refreshedCookies(tokens, resolved.tokens)] };
  } catch (error) {
    if (!(error instanceof AuthUnavailableError)) {
      throw error;
    }

    console.warn('Account request failed:', error.message);

    return json(503, { error: unavailableMessage });
  }
}

async function linkPlayer(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const refusal = { signedOutMessage: 'Sign in to link the desktop app.', unavailableMessage: LINK_UNAVAILABLE };

  return withSession(request, gateway, refusal, async (tokens) => {
    const code = normalizeLinkCode((request.body as { code?: unknown } | undefined)?.code);

    // A string that cannot be a code is no guess at one, so it costs the account no attempt.
    if (!code) {
      return json(400, { error: LINK_CODE_REFUSED });
    }

    const result = await gateway().redeemLinkCode(tokens, code);

    switch (result.status) {
      case 'linked':
        return json(200, { player: result.player });
      case 'invalid':
        return json(400, { error: LINK_CODE_REFUSED });
      case 'rate-limited':
        return json(429, {
          error: `Too many wrong codes. Try again in ${minutesFrom(result.retryAfterSeconds)}.`,
          retryAfterSeconds: result.retryAfterSeconds,
        });
    }
  });
}

/** "1 minute", "11 minutes": whole minutes, rounded up so the wait is never understated. */
function minutesFrom(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));

  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

async function unlinkPlayer(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const refusal = { signedOutMessage: 'Sign in to unlink the desktop app.', unavailableMessage: LINK_UNAVAILABLE };

  return withSession(request, gateway, refusal, async (tokens) => {
    await gateway().unlinkPlayer(tokens);

    return json(200, { player: null });
  });
}

/**
 * The signed-in player's own stats, derived here from the lines the database proved are theirs. Only
 * the derived figures leave this function: no line, uid or recorder id reaches the browser.
 */
async function readDashboard(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  return withSession(
    request,
    gateway,
    { signedOutMessage: 'Sign in to see your dashboard.', unavailableMessage: DASHBOARD_UNAVAILABLE },
    async (tokens) => {
      const read = await gateway().readOwnDashboard(tokens);
      const body: OwnDashboardResponse = read.linked
        ? { linked: true, player: read.player, truncated: read.truncated, stats: deriveOwnDashboard(read.lines) }
        : { linked: false };

      return json(200, body);
    },
  );
}

async function startDiscord(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  if (!isSignInHost(request.host)) {
    return json(403, { error: 'Sign-in is available on rivalspulse.com and localhost only.' });
  }

  const { url, verifier } = await gateway().authorizeUrl('discord', `${originOf(request)}/api/auth/callback`);

  return {
    status: 302,
    location: url,
    cookies: [serializePkceCookie({ verifier, next: safeNext(request.query.get('next')) })],
  };
}

async function finishDiscord(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  if (!isSignInHost(request.host)) {
    return json(403, { error: 'Sign-in is available on rivalspulse.com and localhost only.' });
  }

  const state = readPkceState(request.cookieHeader);
  const code = request.query.get('code');

  // The player pressed Cancel at Discord, or the link is stale: nothing to exchange.
  if (request.query.has('error') || !state || !code) {
    return redirectToSignIn('cancelled');
  }

  const tokens = await gateway().exchangeCode(code, state.verifier);

  if (!tokens) {
    return redirectToSignIn('failed');
  }

  let sessionCookie: string;

  try {
    sessionCookie = serializeSessionCookie({ ...tokens, signedInAt: nowSeconds(request) });
  } catch (error) {
    // A session too big for one cookie cannot be kept; the visitor should see the sign-in page, not JSON.
    console.error('The sign-in session could not be stored', error);

    return redirectToSignIn('failed');
  }

  return {
    status: 302,
    location: safeNext(state.next),
    cookies: [sessionCookie, clearPkceCookie()],
  };
}

async function signOut(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const tokens = readSessionTokens(request.cookieHeader);

  if (tokens) {
    try {
      await gateway().signOut(tokens);
    } catch (error) {
      // The visitor asked to leave, so the cookie goes even when Supabase cannot be asked.
      if (!(error instanceof AuthUnavailableError)) {
        throw error;
      }

      console.warn('Sign-out could not reach Supabase:', error.message);
    }
  }

  return { ...json(200, { signedIn: false }), cookies: [clearSessionCookie()] };
}

async function deleteAccount(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const tokens = readSessionTokens(request.cookieHeader);

  if (!tokens) {
    return json(401, { error: 'Sign in to delete your account.' });
  }

  const asked = parseDeletion(request.body);

  if (!asked) {
    return json(400, { error: 'Choose what to remove.' });
  }

  if (!isDeletionConfirmed(asked.confirmation)) {
    return json(400, { error: 'Type the confirmation phrase exactly to delete your account.' });
  }

  if (asked.mode !== 'account') {
    return json(409, { error: 'Forgetting your match data is not available yet. Remove the account only.' });
  }

  if (!signedInRecently(tokens.signedInAt, nowSeconds(request))) {
    return json(401, {
      error: 'For your safety, sign in again before deleting your account.',
      reason: 'recent-sign-in-required',
    });
  }

  let result: 'deleted' | 'not-signed-in';

  try {
    result = await gateway().deleteAccount(tokens);
  } catch (error) {
    if (!(error instanceof AuthUnavailableError)) {
      throw error;
    }

    console.warn('Account deletion failed:', error.message);

    return json(503, { error: DELETE_FAILED });
  }

  return {
    ...(result === 'deleted'
      ? json(200, { deleted: true })
      : json(401, { error: 'Your session has ended. Sign in again to delete your account.' })),
    cookies: [clearSessionCookie()],
  };
}

/** A sign-in time in the future is as untrustworthy as a missing one. */
function signedInRecently(signedInAt: number | undefined, nowSeconds: number): boolean {
  return signedInAt !== undefined && signedInAt <= nowSeconds && nowSeconds - signedInAt <= RECENT_SIGN_IN_SECONDS;
}

function nowSeconds(request: AccountRequest): number {
  return Math.floor((request.nowMs ?? Date.now()) / 1000);
}

function parseDeletion(body: unknown): DeleteAccountRequest | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined;
  }

  const { mode, confirmation } = body as { mode?: unknown; confirmation?: unknown };
  const known = DELETION_MODES.find((candidate) => candidate === mode);

  return known && typeof confirmation === 'string' ? { mode: known, confirmation } : undefined;
}

function redirectToSignIn(reason: 'cancelled' | 'failed'): AccountResponse {
  return { status: 302, location: `/sign-in?error=${reason}`, cookies: [clearPkceCookie()] };
}

/**
 * Only a path on this site; anything else, such as `//evil.example`, becomes the account page. The
 * address is resolved the way a browser would (which also drops tabs and newlines and reads `\` as
 * `/`) and only the same-origin path and query are kept. A path that still begins `//` after that
 * (`/.//evil.example`) would be read as another site by a redirect, so it is refused too.
 */
function safeNext(next: string | null): string {
  if (!next || next.length > MAX_NEXT_LENGTH) {
    return DEFAULT_NEXT;
  }

  try {
    const url = new URL(next, NEXT_BASE);
    const local = `${url.pathname}${url.search}`;

    return url.origin === NEXT_BASE.origin && !local.startsWith('//') && !url.pathname.startsWith('/api')
      ? local
      : DEFAULT_NEXT;
  } catch {
    return DEFAULT_NEXT;
  }
}

function hostnameOf(host: string): string {
  return host.split(':')[0].toLowerCase();
}

function isSignInHost(host: string): boolean {
  return SIGN_IN_HOSTNAMES.includes(hostnameOf(host));
}

function originOf(request: AccountRequest): string {
  const protocol = request.protocol ?? (hostnameOf(request.host) === 'localhost' ? 'http' : 'https');

  return `${protocol}://${request.host}`;
}

/** A browser always sends `Origin` with a POST, so a missing or foreign one is not our page. */
function isSameOrigin(request: AccountRequest): boolean {
  if (!request.originHeader) {
    return false;
  }

  try {
    return new URL(request.originHeader).host.toLowerCase() === request.host.toLowerCase();
  } catch {
    return false;
  }
}

function methodNotAllowed(): AccountResponse {
  return json(405, { error: 'Method not allowed' });
}

function json(status: number, body: unknown): AccountResponse {
  return { status, body, cookies: [] };
}
