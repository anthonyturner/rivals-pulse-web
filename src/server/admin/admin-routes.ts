import { json, type AccountRequest, type AccountResponse } from '../account/account-session.ts';
import type { AuthGateway, SessionTokens } from '../auth/index.ts';

/** What an admin route is given. It is only ever built for a request the wrapper has let through. */
export interface AdminContext {
  request: AccountRequest;
  /** The admin's own session. Database calls made with it run as the admin, under row-level security. */
  tokens: SessionTokens;
  gateway: AuthGateway;
}

export interface AdminRoute {
  method: 'GET' | 'POST';
  run(context: AdminContext): Promise<AccountResponse>;
}

/**
 * Every admin API route, keyed by its path after `/api/`. `handleAdminRequest` answers 401, 403 and
 * the cache header for all of them, so a route here only says what it does for an admin.
 *
 * To add one: add an entry here, add `api/admin/<name>.ts` exporting `adminRouteHandler('admin/<name>')`
 * (Vercel serves a file only at its own path), and add its tests. Express needs nothing: it mounts the
 * whole `/api/admin/` prefix. A test fails when a route here has no file, or a file has no route.
 */
export const ADMIN_ROUTES: Readonly<Record<string, AdminRoute>> = {
  // Proves the gate end to end: an admin gets 200, every other caller is refused before this runs.
  'admin/me': { method: 'GET', run: async () => json(200, { admin: true }) },
};
