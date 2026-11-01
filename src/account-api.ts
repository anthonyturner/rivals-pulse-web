import {
  clearPkceCookie,
  clearSessionCookie,
  readPkceState,
  readSessionTokens,
  serializePkceCookie,
  serializeSessionCookie,
} from './auth-cookies.js';
import { AuthUnavailableError, type AuthGateway } from './auth-gateway.js';
import {
  DELETION_MODES,
  isDeletionConfirmed,
  type DeleteAccountRequest,
} from './app/core/auth/account-deletion.types.js';

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

  const refreshed =
    resolved.tokens.accessToken !== tokens.accessToken || resolved.tokens.refreshToken !== tokens.refreshToken;

  return {
    ...json(200, { signedIn: true, account: resolved.account }),
    cookies: refreshed ? [serializeSessionCookie(resolved.tokens)] : [],
  };
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
    sessionCookie = serializeSessionCookie(tokens);
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

  const result = await gateway().deleteAccount(tokens);

  return {
    ...(result === 'deleted'
      ? json(200, { deleted: true })
      : json(401, { error: 'Your session has ended. Sign in again to delete your account.' })),
    cookies: [clearSessionCookie()],
  };
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
