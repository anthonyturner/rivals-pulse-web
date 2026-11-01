import type { IncomingMessage, ServerResponse } from 'http';

import { handleAccountRequest, type AccountRequest } from './account-api.js';
import { createSupabaseAuthGateway, type AuthGateway } from './auth-gateway.js';

/** An answer about one visitor must never be stored by a shared cache. */
const NO_STORE = 'private, no-store, max-age=0';

/** True for the paths the account routes own: `auth/...` and `account/...`. */
export function isAccountRoute(route: string): boolean {
  return route.startsWith('auth/') || route.startsWith('account/');
}

/**
 * Runs one account request on a Node server. Express and the Vercel function both hand over their
 * request and response, which are Node's own types.
 */
export async function handleAccountHttp(
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  getGateway: () => AuthGateway = () => createSupabaseAuthGateway(process.env),
): Promise<void> {
  const response = await handleAccountRequest(toAccountRequest(req, route), getGateway);
  const hasBody = response.body !== undefined;

  res.writeHead(response.status, {
    'cache-control': NO_STORE,
    ...(hasBody ? { 'content-type': 'application/json; charset=utf-8' } : {}),
    ...(response.location ? { location: response.location } : {}),
    ...(response.cookies.length > 0 ? { 'set-cookie': response.cookies } : {}),
  });
  res.end(hasBody ? JSON.stringify(response.body) : undefined);
}

function toAccountRequest(req: IncomingMessage, route: string): AccountRequest {
  const url = new URL(req.url ?? '/', 'https://local.invalid');

  return {
    method: (req.method ?? 'GET').toUpperCase(),
    route,
    query: url.searchParams,
    cookieHeader: firstOf(req.headers.cookie),
    originHeader: firstOf(req.headers.origin),
    host: firstValue(firstOf(req.headers['x-forwarded-host']) ?? firstOf(req.headers.host)) ?? 'localhost',
    protocol: firstValue(firstOf(req.headers['x-forwarded-proto'])),
  };
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A proxy chain joins values with commas; the first is the one the visitor's browser used. */
function firstValue(value: string | undefined): string | undefined {
  return value?.split(',')[0].trim() || undefined;
}
