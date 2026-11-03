import type { IncomingMessage, ServerResponse } from 'http';

import { handleAccountRequest, type AccountRequest } from './account-api.js';
import { createSupabaseAuthGateway, type AuthGateway } from '../auth/auth-gateway.js';

/** An answer about one visitor must never be stored by a shared cache. */
const NO_STORE = 'private, no-store, max-age=0';
/** The only body the account routes read is a mode and a short phrase. */
const MAX_BODY_BYTES = 4096;

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
  const response = await handleAccountRequest(await toAccountRequest(req, route), getGateway);
  const hasBody = response.body !== undefined;

  res.writeHead(response.status, {
    'cache-control': NO_STORE,
    ...(hasBody ? { 'content-type': 'application/json; charset=utf-8' } : {}),
    ...(response.location ? { location: response.location } : {}),
    ...(response.cookies.length > 0 ? { 'set-cookie': response.cookies } : {}),
  });
  res.end(hasBody ? JSON.stringify(response.body) : undefined);
}

/**
 * A Vercel function for one account route. Vercel only serves a file under `api/` at its own path,
 * so each route in `account-api.ts` needs its own file that exports this.
 */
export function accountRouteHandler(route: string) {
  return (req: IncomingMessage, res: ServerResponse): Promise<void> => handleAccountHttp(req, res, route);
}

async function toAccountRequest(req: IncomingMessage, route: string): Promise<AccountRequest> {
  const url = new URL(req.url ?? '/', 'https://local.invalid');
  const method = (req.method ?? 'GET').toUpperCase();

  return {
    method,
    route,
    query: url.searchParams,
    cookieHeader: firstOf(req.headers.cookie),
    originHeader: firstOf(req.headers.origin),
    body: method === 'POST' ? await readJsonBody(req) : undefined,
    host: firstValue(firstOf(req.headers['x-forwarded-host']) ?? firstOf(req.headers.host)) ?? 'localhost',
    protocol: firstValue(firstOf(req.headers['x-forwarded-proto'])),
  };
}

/**
 * The JSON a POST sent, or undefined when it was missing, too big or not JSON. Vercel has parsed
 * `req.body` before the handler runs; Express has no body parser, so the stream is read here.
 */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  try {
    const parsed = (req as { body?: unknown }).body;

    if (parsed !== undefined) {
      return typeof parsed === 'string' || parsed instanceof Uint8Array
        ? JSON.parse(typeof parsed === 'string' ? parsed : new TextDecoder().decode(parsed))
        : parsed;
    }

    const decoder = new TextDecoder();
    let text = '';
    let size = 0;

    for await (const chunk of req as AsyncIterable<string | Uint8Array>) {
      const bytes = typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;

      size += bytes.length;

      // Keep reading to the end rather than leaving the loop: that would destroy the connection the answer goes out on.
      if (size <= MAX_BODY_BYTES) {
        text += decoder.decode(bytes, { stream: true });
      }
    }

    return size > MAX_BODY_BYTES ? undefined : JSON.parse(text + decoder.decode());
  } catch {
    return undefined;
  }
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** A proxy chain joins values with commas; the first is the one the visitor's browser used. */
function firstValue(value: string | undefined): string | undefined {
  return value?.split(',')[0].trim() || undefined;
}
