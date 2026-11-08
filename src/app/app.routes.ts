import { Routes } from '@angular/router';

import { adminGuard } from './core/auth/admin.guard';
import { signedInGuard } from './core/auth/signed-in.guard';
import { NAVIGATION_CATEGORIES } from './core/navigation/navigation-category.data';
import { knownIdGuard } from './core/navigation/known-id.guard';
import { releasedPageGuard } from './core/navigation/released-page.guard';
import { ROUTE_WITHOUT_SIDEBAR } from './core/layout/sidebar/sidebar-visibility';
import { ROUTE_NOINDEX } from './core/seo/page-meta-title.strategy';
import { HOME_TITLE, SITE_NAME } from './core/seo/site-meta';
import { heroesRoutes } from './features/heroes/heroes.routes';
import { PULSE_RECORDS_PAGES } from './features/records/pulse-records.data';
import { heroGuideRouteTitle, strategistGuideRouteTitle } from './features/learning/guides/guide-titles';

export const routes: Routes = [
  {
    path: '',
    title: HOME_TITLE,
    data: ROUTE_WITHOUT_SIDEBAR,
    loadComponent: () =>
      import('./features/home/home-page.component').then((module) => module.HomePageComponent),
  },
  ...heroesRoutes,
  {
    path: 'community',
    title: 'Community | RivalsPulse',
    loadChildren: () =>
      import('./features/community/community.routes').then((module) => module.communityRoutes),
  },
  {
    path: 'learn',
    redirectTo: 'hero-guides',
    pathMatch: 'full',
  },
  ...NAVIGATION_CATEGORIES.map((category) => ({
    path: category.path.slice(1),
    title: `${category.label} | RivalsPulse`,
    loadComponent: () =>
      import('./core/navigation/navigation-category-page.component').then(
        (module) => module.NavigationCategoryPageComponent,
      ),
    data: { category },
  })),
  {
    path: 'hero-guides',
    title: 'Guides | RivalsPulse',
    loadComponent: () =>
      import('./features/learning/guides/guide-library/hero-guides-page.component').then(
        (module) => module.HeroGuidesPageComponent,
      ),
  },
  {
    path: 'hero-guides/first-time',
    title: 'How to play: first-time guide | RivalsPulse',
    loadComponent: () =>
      import('./features/learning/guides/beginner-guide/first-time-guide-page.component').then(
        (module) => module.FirstTimeGuidePageComponent,
      ),
  },
  {
    path: 'hero-guides/:heroId',
    title: heroGuideRouteTitle,
    canMatch: [
      knownIdGuard(() =>
        import('./features/learning/guides/hero-guides/hero-guide-data').then((module) =>
          module.HERO_GUIDES.map((guide) => guide.heroId),
        ),
      ),
    ],
    loadComponent: () =>
      import('./features/learning/guides/hero-guides/hero-guide-detail-page.component').then(
        (module) => module.HeroGuideDetailPageComponent,
      ),
  },
  {
    path: 'glossary',
    title: 'Glossary | RivalsPulse',
    loadComponent: () =>
      import('./features/reference/glossary/glossary-page.component').then(
        (module) => module.GlossaryPageComponent,
      ),
  },
  {
    path: 'techniques',
    title: 'Techniques | RivalsPulse',
    loadComponent: () =>
      import('./features/learning/guides/techniques/techniques-page.component').then(
        (module) => module.TechniquesPageComponent,
      ),
  },
  {
    path: 'beginner-interactive-guide',
    title: 'How to play: interactive course | RivalsPulse',
    loadComponent: () =>
      import('./features/learning/guides/beginner-guide/beginner-guide-page.component').then(
        (module) => module.BeginnerGuidePageComponent,
      ),
  },
  {
    path: 'build-theory',
    title: 'Build theory | RivalsPulse',
    loadComponent: () =>
      import(
        './features/learning/guides/composition/build-theory/build-theory-page.component'
      ).then(
        (module) => module.BuildTheoryPageComponent,
      ),
  },
  {
    path: 'triple-support-counter',
    title: 'How to break triple support | RivalsPulse',
    loadComponent: () =>
      import(
        './features/learning/guides/composition/triple-support/triple-support-guide-page.component'
      ).then(
        (module) => module.TripleSupportGuidePageComponent,
      ),
  },
  {
    path: 'power-positions',
    title: 'Power positions | RivalsPulse',
    loadComponent: () =>
      import(
        './features/learning/guides/positioning/power-positions/power-positions-page.component'
      ).then(
        (module) => module.PowerPositionsPageComponent,
      ),
  },
  {
    path: 'strategic-cover',
    title: 'Strategic cover | RivalsPulse',
    loadComponent: () =>
      import(
        './features/learning/guides/positioning/strategic-cover/strategic-cover-page.component'
      ).then(
        (module) => module.StrategicCoverPageComponent,
      ),
  },
  {
    path: 'learning-paths',
    title: 'Learning paths | RivalsPulse',
    canMatch: [releasedPageGuard],
    loadComponent: () =>
      import('./features/learning/learning-paths/learning-paths-page.component').then(
        (module) => module.LearningPathsPageComponent,
      ),
  },
  {
    path: 'media-tutorials',
    title: 'Video tutorials | RivalsPulse',
    loadComponent: () =>
      import('./features/learning/media-tutorials/media-tutorials-page.component').then(
        (module) => module.MediaTutorialsPageComponent,
      ),
  },
  {
    path: 'strategist-guides',
    title: 'Strategist guides | RivalsPulse',
    loadComponent: () =>
      import('./features/learning/guides/strategist-guides/strategist-guides-page.component').then(
        (module) => module.StrategistGuidesPageComponent,
      ),
  },
  {
    path: 'strategist-guides/:guideId',
    title: strategistGuideRouteTitle,
    canMatch: [
      knownIdGuard(() =>
        import('./features/learning/guides/strategist-guides/strategist-guides.data').then((module) =>
          module.STRATEGIST_GUIDES.map((guide) => guide.id),
        ),
      ),
    ],
    loadComponent: () =>
      import(
        './features/learning/guides/strategist-guides/strategist-guide-detail-page.component'
      ).then(
        (module) => module.StrategistGuideDetailPageComponent,
      ),
  },
  {
    path: 'user-highlights',
    title: 'User highlights | RivalsPulse',
    loadComponent: () =>
      import('./features/community/user-highlights/user-highlights-page.component').then(
        (module) => module.UserHighlightsPageComponent,
      ),
  },
  {
    path: 'game-stats',
    title: 'Game stats | RivalsPulse',
    loadComponent: () =>
      import('./features/insights/game-stats/game-stats-page.component').then(
        (module) => module.GameStatsPageComponent,
      ),
  },
  {
    path: 'tier-list',
    title: 'Tier list | RivalsPulse',
    loadComponent: () =>
      import('./features/insights/tier-list/tier-list-page.component').then(
        (module) => module.TierListPageComponent,
      ),
  },
  {
    path: 'season-9-win-rates',
    redirectTo: 'win-rates',
    pathMatch: 'full',
  },
  {
    path: 'win-rates',
    title: 'Hero stats | RivalsPulse',
    loadComponent: () =>
      import('./features/insights/win-rates/win-rates-page.component').then(
        (module) => module.WinRatesPageComponent,
      ),
  },
  {
    path: 'win-rates/:season',
    title: 'Hero stats | RivalsPulse',
    loadComponent: () =>
      import('./features/insights/win-rates/win-rates-page.component').then(
        (module) => module.WinRatesPageComponent,
      ),
  },
  {
    path: 'team-comps',
    title: 'Team Comps | RivalsPulse',
    loadComponent: () =>
      import('./features/insights/team-comps/team-comps-page.component').then(
        (module) => module.TeamCompsPageComponent,
      ),
  },
  {
    path: 'records',
    title: 'Pulse Records | RivalsPulse',
    loadComponent: () =>
      import('./features/records/records-page/records-page.component').then(
        (module) => module.RecordsPageComponent,
      ),
  },
  // One route per list rather than `records/:category`: the server routes name each list, so an
  // unknown one reaches the server-rendered not-found route and its 404 status.
  ...PULSE_RECORDS_PAGES.map((page) => ({
    path: `records/${page.slug}`,
    title: `Pulse Records: ${page.title} | ${SITE_NAME}`,
    data: { recordsPage: page },
    loadComponent: () =>
      import('./features/records/records-category-page/records-category-page.component').then(
        (module) => module.RecordsCategoryPageComponent,
      ),
  })),
  {
    path: 'watch-next',
    title: 'Watch next quiz | RivalsPulse',
    canMatch: [releasedPageGuard],
    loadComponent: () =>
      import('./features/learning/watch-next/watch-next-page.component').then(
        (module) => module.WatchNextPageComponent,
      ),
  },
  {
    path: 'counters',
    title: 'Hero counters | RivalsPulse',
    loadComponent: () =>
      import('./features/tools/counters/counters-page.component').then(
        (module) => module.CountersPageComponent,
      ),
  },
  {
    path: 'dive-planner',
    title: 'Dive Response Planner | RivalsPulse',
    loadComponent: () =>
      import('./features/tools/dive-planner/dive-planner-page.component').then(
        (module) => module.DivePlannerPageComponent,
      ),
  },
  {
    path: 'team-builder',
    title: 'Team builder | RivalsPulse',
    loadComponent: () =>
      import('./features/tools/team-builder/team-builder-page.component').then(
        (module) => module.TeamBuilderPageComponent,
      ),
  },
  {
    path: 'how-we-count',
    title: 'How we count | RivalsPulse',
    loadComponent: () =>
      import('./features/how-we-count/how-we-count-page.component').then(
        (module) => module.HowWeCountPageComponent,
      ),
  },
  {
    path: 'faq',
    title: 'FAQ | RivalsPulse',
    loadComponent: () =>
      import('./features/overlay-faq/overlay-faq-page.component').then(
        (module) => module.OverlayFaqPageComponent,
      ),
  },
  {
    path: 'overlay-faq',
    redirectTo: 'faq',
    pathMatch: 'full',
  },
  {
    path: 'privacy',
    title: 'Privacy notes | RivalsPulse',
    loadComponent: () =>
      import('./features/privacy/privacy-page.component').then(
        (module) => module.PrivacyPageComponent,
      ),
  },
  {
    path: 'sign-in',
    title: 'Sign in | RivalsPulse',
    data: ROUTE_WITHOUT_SIDEBAR,
    loadComponent: () =>
      import('./features/account/sign-in-page.component').then(
        (module) => module.SignInPageComponent,
      ),
  },
  {
    path: 'account',
    title: 'Your account | RivalsPulse',
    data: ROUTE_WITHOUT_SIDEBAR,
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./features/account/account-page.component').then(
        (module) => module.AccountPageComponent,
      ),
  },
  {
    path: 'profile',
    title: 'Your stats | RivalsPulse',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./features/profile/profile-page.component').then(
        (module) => module.ProfilePageComponent,
      ),
  },
  {
    path: 'admin',
    title: 'Admin | RivalsPulse',
    data: { ...ROUTE_WITHOUT_SIDEBAR, ...ROUTE_NOINDEX },
    canMatch: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then((module) => module.adminRoutes),
  },
  {
    path: '**',
    title: 'Page not found | RivalsPulse',
    data: ROUTE_WITHOUT_SIDEBAR,
    loadComponent: () =>
      import('./shared/components/not-found/not-found.component').then(
        (module) => module.NotFoundComponent,
      ),
  },
];
