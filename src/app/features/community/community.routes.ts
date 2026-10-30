import type { Routes } from '@angular/router';

import { communityTabMatcher, DEFAULT_COMMUNITY_TAB_ID } from './community-tabs';

export const communityRoutes: Routes = [
  {
    matcher: communityTabMatcher,
    loadComponent: () =>
      import('./community-page/community-page.component').then(
        (module) => module.CommunityPageComponent,
      ),
  },
  { path: '**', redirectTo: DEFAULT_COMMUNITY_TAB_ID },
];
