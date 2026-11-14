import {
  AuthUnavailableError,
  clearSessionCookie,
  readSessionTokens,
  serializeSessionCookie,
  type AuthGateway,
  type ResolvedSession,
  type SessionTokens,
} from '../auth/index.ts';

/**
 * A request as the session-bound routes (account and admin) see it, free of any server framework:
 * Express and the Vercel function both turn theirs into this (`account-http.ts`), so the rules are
 * written once.
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

const SIGN_IN_UNAVAILABLE = 'Sign-in is unavailable right now. Try again in a moment.';

export function json(status: number, body: unknown): AccountResponse {
  return { status, body, cookies: [] };
}

export function methodNotAllowed(): AccountResponse {
  return json(405, { error: 'Method not allowed' });
}

/**
 * The answer for a request that threw: 503 when Supabase could not be asked, otherwise a 500 that
 * says nothing of the cause. It carries no cookies; a route that has refreshed the session adds its own.
 */
export function failureResponse(error: unknown, unavailableMessage = SIGN_IN_UNAVAILABLE): AccountResponse {
  if (error instanceof AuthUnavailableError) {
    console.warn('Account request failed:', error.message);

    return json(503, { error: unavailableMessage });
  }

  console.error('Account request failed', error);

  return json(500, { error: 'Something went wrong.' });
}

/** A browser always sends `Origin` with a POST, so a missing or foreign one is not our page. */
export function isSameOrigin(request: AccountRequest): boolean {
  if (!request.originHeader) {
    return false;
  }

  try {
    return new URL(request.originHeader).host.toLowerCase() === request.host.toLowerCase();
  } catch {
    return false;
  }
}

/** The cookie to set when Supabase handed back new tokens, keeping the original sign-in time. */
export function refreshedCookies(original: SessionTokens, current: SessionTokens): string[] {
  const refreshed = current.accessToken !== original.accessToken || current.refreshToken !== original.refreshToken;

  return refreshed ? [serializeSessionCookie({ ...current, signedInAt: original.signedInAt })] : [];
}

/**
 * Runs `act` for a signed-in visitor, with tokens Supabase has just confirmed. Linking and the
 * dashboard are conveniences, so a Supabase that cannot be reached is a 503 here and never signs
 * anyone out.
 *
 * When the tokens had expired and were refreshed, the new cookie rides on every answer from that
 * point on, failures included. Supabase rotates refresh tokens, so an answer that dropped it would
 * leave the browser holding a used one and sign the player out on the next request.
 */
export async function withSession(
  request: AccountRequest,
  gateway: () => AuthGateway,
  { signedOutMessage, unavailableMessage }: { signedOutMessage: string; unavailableMessage: string },
  act: (tokens: SessionTokens) => Promise<AccountResponse>,
): Promise<AccountResponse> {
  const tokens = readSessionTokens(request.cookieHeader);

  if (!tokens) {
    return json(401, { error: signedOutMessage });
  }

  let resolved: ResolvedSession | undefined;

  try {
    resolved = await gateway().resolve(tokens);
  } catch (error) {
    return failureResponse(error, unavailableMessage);
  }

  if (!resolved) {
    return { ...json(401, { error: signedOutMessage }), cookies: [clearSessionCookie()] };
  }

  const response = await act(resolved.tokens).catch((error: unknown) => failureResponse(error, unavailableMessage));

  return { ...response, cookies: [...response.cookies, ...refreshedCookies(tokens, resolved.tokens)] };
}
