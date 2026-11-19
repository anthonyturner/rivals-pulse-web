import type { Route, Routes } from '@angular/router';

import { LEGACY_REDIRECTS, LEGACY_REDIRECT_PREFIXES, type LegacyRedirect } from './legacy-redirects';

const pathOf = (address: string): string => address.slice(1);

/**
 * The old stat addresses, answered with a redirect to the Stats hub. The server answers these with
 * a temporary redirect only; the permanent one crawlers need is in `vercel.json`, which sits in
 * front of the app in production.
 */
export const legacyRedirectRoutes: Routes = [
  ...LEGACY_REDIRECTS.map(({ from, to }): Route => ({ path: pathOf(from), redirectTo: to, pathMatch: 'full' })),
  ...LEGACY_REDIRECT_PREFIXES.map(({ from, to }: LegacyRedirect): Route => ({
    path: pathOf(from),
    children: [{ path: '**', redirectTo: to }],
  })),
];
