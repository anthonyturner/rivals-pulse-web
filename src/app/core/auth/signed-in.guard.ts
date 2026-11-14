import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Sends a signed-out visitor to the sign-in page, which sends them back here afterwards. The check
 * runs in the browser; the account routes are client-rendered, so a server has nothing to decide.
 */
export const signedInGuard: CanActivateFn = async (_route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) {
    return true;
  }

  // Both are injected before the await: inject() only works until the first one.
  const auth = inject(AuthService);
  const router = inject(Router);
  const session = await auth.load();

  return session.status === 'signedIn'
    ? true
    : router.createUrlTree(['/sign-in'], { queryParams: { next: state.url } });
};
