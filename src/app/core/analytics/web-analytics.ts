import { isPlatformBrowser } from '@angular/common';
import { EnvironmentProviders, inject, InjectionToken, isDevMode, PLATFORM_ID, provideAppInitializer } from '@angular/core';
import { inject as injectVercelAnalytics } from '@vercel/analytics';

/** Whether to count page views at all. Development builds and tests do not. */
export const WEB_ANALYTICS_ENABLED = new InjectionToken<boolean>('WEB_ANALYTICS_ENABLED', {
  providedIn: 'root',
  factory: () => !isDevMode(),
});

/**
 * Adds Vercel's Web Analytics script to the page. Its default tracks page views on every history
 * `pushState`, which is how the router moves between pages, so route changes are counted without
 * any code of ours. Tests replace it so no script is added.
 */
export const START_WEB_ANALYTICS = new InjectionToken<() => void>('START_WEB_ANALYTICS', {
  providedIn: 'root',
  factory: () => () => injectVercelAnalytics({ mode: 'production' }),
});

/** Starts page view counting once, in the browser only: the script needs `document` and counts a real visit. */
export function provideWebAnalytics(): EnvironmentProviders {
  return provideAppInitializer(() => {
    if (isPlatformBrowser(inject(PLATFORM_ID)) && inject(WEB_ANALYTICS_ENABLED)) {
      inject(START_WEB_ANALYTICS)();
    }
  });
}
