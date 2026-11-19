import type { IncomingMessage, ServerResponse } from 'http';

import { respondPrivately } from '../account/account-http.ts';
import { createSupabaseAuthGateway, type AuthGateway } from '../auth/index.ts';
import { handleAdminRequest } from './admin-api.ts';

/** Runs one admin request on a Node server. Express and the Vercel function both call this. */
export async function handleAdminHttp(
  req: IncomingMessage,
  res: ServerResponse,
  route: string,
  getGateway: () => AuthGateway = () => createSupabaseAuthGateway(process.env),
): Promise<void> {
  await respondPrivately(req, res, route, (request) => handleAdminRequest(request, getGateway));
}

/**
 * A Vercel function for one admin route. Vercel only serves a file under `api/` at its own path, so
 * each route in `ADMIN_ROUTES` needs its own file that exports this.
 */
export function adminRouteHandler(route: string) {
  return (req: IncomingMessage, res: ServerResponse): Promise<void> => handleAdminHttp(req, res, route);
}
