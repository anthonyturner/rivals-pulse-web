import { inject, InjectionToken, isDevMode } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';

import { NAVIGATION_CATEGORIES } from './navigation-category.data';

/** Lets development builds open pages that are still marked Coming soon. */
export const SHOW_UNRELEASED_PAGES = new InjectionToken<boolean>('SHOW_UNRELEASED_PAGES', {
  providedIn: 'root',
  factory: () => isDevMode(),
});

/**
 * Sends a visit to a page whose hub card is disabled back to that hub, so a
 * page is reachable exactly when its card says it is released.
 */
export const releasedPageGuard: CanMatchFn = (route) => {
  if (inject(SHOW_UNRELEASED_PAGES)) {
    return true;
  }

  const path = `/${route.path}`;
  const category = NAVIGATION_CATEGORIES.find((entry) =>
    entry.items.some((item) => item.path === path && !item.enabled),
  );

  return category ? inject(Router).parseUrl(category.path) : true;
};
