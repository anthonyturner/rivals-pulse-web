import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Sends anyone the server does not call an administrator to the home page, before the admin pages
 * are even downloaded. This only decides what a visitor sees: the admin API and the database refuse
 * every non-admin themselves (ADR-0005), so a visitor who skips this guard gets an empty shell
 * whose every request is turned away. The check runs in the browser, like `signedInGuard`:
 * a server render has no visitor to ask about, so it lets the route through.
 */
export const adminGuard: CanMatchFn = async () => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  // Both are injected before the await: inject() only works until the first one.
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = await auth.load();

  return session.status === 'signedIn' && session.isAdmin ? true : router.parseUrl('/');
};
