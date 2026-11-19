import {
  AuthUnavailableError,
  clearPkceCookie,
  clearSessionCookie,
  readPkceState,
  readSessionTokens,
  serializePkceCookie,
  serializeSessionCookie,
  type AuthGateway,
} from '../auth/index.ts';
import {
  failureResponse,
  isSameOrigin,
  json,
  methodNotAllowed,
  refreshedCookies,
  withSession,
  type AccountRequest,
  type AccountResponse,
} from './account-session.ts';
import { normalizeLinkCode } from './link-code.ts';
import { deriveOwnDashboard } from './own-dashboard.ts';
import {
  DELETION_MODES,
  isDeletionConfirmed,
  type DeleteAccountRequest,
} from '../../app/core/auth/account-deletion.types.ts';
import { parseMediaDefaultsChange } from '../../app/core/auth/media-defaults.types.ts';
import type { OwnDashboardResponse } from '../../app/core/auth/own-dashboard.types.ts';

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
const RECORDS_OPT_IN_UNAVAILABLE = 'Your Pulse Records setting is unavailable right now. Try again in a moment.';
const RECORDS_OPT_IN_NEEDS_LINK = 'Link the desktop app first. Pulse Records can only show the name of a linked player.';
const MEDIA_DEFAULTS_UNAVAILABLE = 'Your video and sound settings are unavailable right now. Try again in a moment.';
const DASHBOARD_UNAVAILABLE = 'Your dashboard is unavailable right now. Try again in a moment.';
const DELETE_FAILED = 'The deletion did not go through, as far as we can tell. Try again in a moment.';

export async function handleAccountRequest(
  request: AccountRequest,
  getGateway: () => AuthGateway,
): Promise<AccountResponse> {
  try {
    return await route(request, getGateway);
  } catch (error) {
    return failureResponse(error);
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
    case 'account/records-opt-in':
      return method === 'GET'
        ? readRecordsOptIn(request, gateway)
        : method === 'POST'
          ? setRecordsOptIn(request, gateway)
          : methodNotAllowed();
    case 'account/media-defaults':
      return method === 'POST' ? setMediaDefaults(request, gateway) : methodNotAllowed();
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

  const [player, isAdmin, mediaDefaults] = await Promise.all([
    gateway().linkedPlayer(resolved.tokens),
    gateway().isAdmin(resolved.tokens).catch(adminCheckFailed),
    gateway().readMediaDefaults(resolved.tokens),
  ]);

  return {
    ...json(200, { signedIn: true, account: resolved.account, player, isAdmin, mediaDefaults }),
    cookies: refreshedCookies(tokens, resolved.tokens),
  };
}

/**
 * The Admin link is a convenience, so a Supabase that cannot say reads as "not an admin". The
 * admin routes ask again and answer 503 in that case; nothing is granted on this answer.
 */
function adminCheckFailed(error: unknown): false {
  console.warn('The admin check could not be read:', error instanceof Error ? error.message : error);

  return false;
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

/** Whether the signed-in account named itself on Pulse Records. A read that fails is a 503, never "off". */
async function readRecordsOptIn(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const refusal = { signedOutMessage: 'Sign in to see this setting.', unavailableMessage: RECORDS_OPT_IN_UNAVAILABLE };

  return withSession(request, gateway, refusal, async (tokens) =>
    json(200, { showInRecords: await gateway().readRecordsOptIn(tokens) }),
  );
}

/**
 * Switches the signed-in account's own "Show me in Pulse Records". The body is `{ show: boolean }` and
 * nothing in it names an account: the database acts on the session's account alone.
 */
async function setRecordsOptIn(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const refusal = { signedOutMessage: 'Sign in to change this setting.', unavailableMessage: RECORDS_OPT_IN_UNAVAILABLE };

  return withSession(request, gateway, refusal, async (tokens) => {
    const show = (request.body as { show?: unknown } | undefined)?.show;

    // Anything but a real boolean is no choice at all, so it must not become "off" by accident.
    if (typeof show !== 'boolean') {
      return json(400, { error: 'Choose on or off.' });
    }

    const result = await gateway().setRecordsOptIn(tokens, show);

    return result.status === 'saved'
      ? json(200, { showInRecords: result.showInRecords })
      : json(409, { error: RECORDS_OPT_IN_NEEDS_LINK });
  });
}

/**
 * Saves the signed-in account's own hero video and sound defaults. The body names the ones to change,
 * as `{ heroVideo?: boolean, sound?: boolean }`, and nothing in it names an account: the database acts
 * on the session's account alone.
 */
async function setMediaDefaults(request: AccountRequest, gateway: () => AuthGateway): Promise<AccountResponse> {
  const refusal = { signedOutMessage: 'Sign in to change this setting.', unavailableMessage: MEDIA_DEFAULTS_UNAVAILABLE };

  return withSession(request, gateway, refusal, async (tokens) => {
    const change = parseMediaDefaultsChange(request.body);

    // Anything but a real boolean is no choice at all, so it must not become "off" by accident.
    if (!change) {
      return json(400, { error: 'Choose on or off.' });
    }

    return json(200, await gateway().setMediaDefaults(tokens, change));
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
