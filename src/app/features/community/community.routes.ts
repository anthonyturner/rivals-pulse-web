import type { Routes } from '@angular/router';

import { DEFAULT_COMMUNITY_TAB_ID, isCommunityTab } from './community-tabs';

/**
 * The tab is a `:tab` path parameter rather than a custom matcher: the server builds its route table
 * from route paths, and it files a matcher route under the catch-all `**`, which here is the redirect
 * below, so every tab address would be answered with a redirect to the default tab.
 */
export const communityRoutes: Routes = [
  {
    path: ':tab',
    canMatch: [isCommunityTab],
    loadComponent: () =>
      import('./community-page/community-page.component').then(
        (module) => module.CommunityPageComponent,
      ),
  },
  { path: '**', redirectTo: DEFAULT_COMMUNITY_TAB_ID },
];
