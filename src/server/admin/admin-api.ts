import { failureResponse, isSameOrigin, json, methodNotAllowed, withSession } from '../account/account-session.ts';
import type { AccountRequest, AccountResponse } from '../account/account-session.ts';
import type { AuthGateway } from '../auth/index.ts';
import { ADMIN_ROUTES, type AdminRoute } from './admin-routes.ts';

const SIGNED_OUT = 'Sign in to open the admin area.';
const UNAVAILABLE = 'The admin area is unavailable right now. Try again in a moment.';

/**
 * The one door to every `/api/admin/*` route (ADR-0005). Before a route in `ADMIN_ROUTES` runs, the
 * request has a valid session (401 if not) and the database has said the account is an admin
 * (403 if not). Both come before the route is even looked up, so a caller who is not an admin
 * cannot tell a real route from a made-up one. Nothing here reads the service-role key: the check
 * and the routes run under the admin's own session, and the database decides.
 *
 * `routes` is the table to serve; only tests pass another.
 *
 * The cache header is not set here but where the answer is written (`respondPrivately`), which is
 * also where the account routes get theirs, so it holds for every answer including these refusals.
 */
export async function handleAdminRequest(
  request: AccountRequest,
  getGateway: () => AuthGateway,
  routes: Readonly<Record<string, AdminRoute>> = ADMIN_ROUTES,
): Promise<AccountResponse> {
  try {
    return await guarded(request, getGateway, routes);
  } catch (error) {
    return failureResponse(error, UNAVAILABLE);
  }
}

async function guarded(
  request: AccountRequest,
  getGateway: () => AuthGateway,
  routes: Readonly<Record<string, AdminRoute>>,
): Promise<AccountResponse> {
  if (request.method !== 'GET' && !isSameOrigin(request)) {
    return json(403, { error: 'Cross-site request refused.' });
  }

  return withSession(
    request,
    getGateway,
    { signedOutMessage: SIGNED_OUT, unavailableMessage: UNAVAILABLE },
    async (tokens) => {
      const gateway = getGateway();

      // The database is asked on every request and the answer is kept nowhere, so revoking is immediate.
      if (!(await gateway.isAdmin(tokens))) {
        return json(403, { error: 'This account is not an administrator.' });
      }

      if (!Object.hasOwn(routes, request.route)) {
        return json(404, { error: 'API route not found' });
      }

      const route = routes[request.route];

      return route.method === request.method ? route.run({ request, tokens, gateway }) : methodNotAllowed();
    },
  );
}
