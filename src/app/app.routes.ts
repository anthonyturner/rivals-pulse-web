import { Routes } from '@angular/router';

import { NAVIGATION_CATEGORIES } from './core/navigation/navigation-category.data';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home-page.component').then((module) => module.HomePageComponent),
  },
  {
    path: 'heroes',
    loadComponent: () =>
      import('./features/heroes/heroes-page.component').then(
        (module) => module.HeroesPageComponent,
      ),
  },
  {
    path: 'learn',
    redirectTo: 'hero-guides',
    pathMatch: 'full',
  },
  ...NAVIGATION_CATEGORIES.map((category) => ({
    path: category.path.slice(1),
    loadComponent: () =>
      import('./core/navigation/navigation-category-page.component').then(
        (module) => module.NavigationCategoryPageComponent,
      ),
    data: { category },
  })),
  {
    path: 'hero-guides',
    loadComponent: () =>
      import('./features/learning/guides/guide-library/hero-guides-page.component').then(
        (module) => module.HeroGuidesPageComponent,
      ),
  },
  {
    path: 'hero-guides/first-time',
    loadComponent: () =>
      import('./features/learning/guides/beginner-guide/first-time-guide-page.component').then(
        (module) => module.FirstTimeGuidePageComponent,
      ),
  },
  {
    path: 'hero-guides/:heroId',
    loadComponent: () =>
      import('./features/learning/guides/hero-guides/hero-guide-detail-page.component').then(
        (module) => module.HeroGuideDetailPageComponent,
      ),
  },
  {
    path: 'glossary',
    loadComponent: () =>
      import('./features/reference/glossary/glossary-page.component').then(
        (module) => module.GlossaryPageComponent,
      ),
  },
  {
    path: 'techniques',
    loadComponent: () =>
      import('./features/learning/guides/techniques/techniques-page.component').then(
        (module) => module.TechniquesPageComponent,
      ),
  },
  {
    path: 'beginner-interactive-guide',
    loadComponent: () =>
      import('./features/learning/guides/beginner-guide/beginner-guide-page.component').then(
        (module) => module.BeginnerGuidePageComponent,
      ),
  },
  {
    path: 'build-theory',
    loadComponent: () =>
      import(
        './features/learning/guides/composition/build-theory/build-theory-page.component'
      ).then(
        (module) => module.BuildTheoryPageComponent,
      ),
  },
  {
    path: 'triple-support-counter',
    loadComponent: () =>
      import(
        './features/learning/guides/composition/triple-support/triple-support-guide-page.component'
      ).then(
        (module) => module.TripleSupportGuidePageComponent,
      ),
  },
  {
    path: 'power-positions',
    loadComponent: () =>
      import(
        './features/learning/guides/positioning/power-positions/power-positions-page.component'
      ).then(
        (module) => module.PowerPositionsPageComponent,
      ),
  },
  {
    path: 'strategic-cover',
    loadComponent: () =>
      import(
        './features/learning/guides/positioning/strategic-cover/strategic-cover-page.component'
      ).then(
        (module) => module.StrategicCoverPageComponent,
      ),
  },
  {
    path: 'learning-paths',
    loadComponent: () =>
      import('./features/learning/learning-paths/learning-paths-page.component').then(
        (module) => module.LearningPathsPageComponent,
      ),
  },
  {
    path: 'media-tutorials',
    loadComponent: () =>
      import('./features/learning/media-tutorials/media-tutorials-page.component').then(
        (module) => module.MediaTutorialsPageComponent,
      ),
  },
  {
    path: 'strategist-guides',
    loadComponent: () =>
      import('./features/learning/guides/strategist-guides/strategist-guides-page.component').then(
        (module) => module.StrategistGuidesPageComponent,
      ),
  },
  {
    path: 'strategist-guides/:guideId',
    loadComponent: () =>
      import(
        './features/learning/guides/strategist-guides/strategist-guide-detail-page.component'
      ).then(
        (module) => module.StrategistGuideDetailPageComponent,
      ),
  },
  {
    path: 'user-highlights',
    loadComponent: () =>
      import('./features/community/user-highlights/user-highlights-page.component').then(
        (module) => module.UserHighlightsPageComponent,
      ),
  },
  {
    path: 'game-stats',
    loadComponent: () =>
      import('./features/insights/game-stats/game-stats-page.component').then(
        (module) => module.GameStatsPageComponent,
      ),
  },
  {
    path: 'tier-list',
    loadComponent: () =>
      import('./features/insights/tier-list/tier-list-page.component').then(
        (module) => module.TierListPageComponent,
      ),
  },
  {
    path: 'season-9-win-rates',
    redirectTo: 'win-rates/9',
    pathMatch: 'full',
  },
  {
    path: 'win-rates',
    redirectTo: 'win-rates/9',
    pathMatch: 'full',
  },
  {
    path: 'win-rates/:season',
    loadComponent: () =>
      import('./features/insights/win-rate-reports/season-win-rates-page.component').then(
        (module) => module.SeasonWinRatesPageComponent,
      ),
  },
  {
    path: 'watch-next',
    loadComponent: () =>
      import('./features/learning/watch-next/watch-next-page.component').then(
        (module) => module.WatchNextPageComponent,
      ),
  },
  {
    path: 'counters',
    loadComponent: () =>
      import('./features/tools/counters/counters-page.component').then(
        (module) => module.CountersPageComponent,
      ),
  },
  {
    path: 'team-builder',
    loadComponent: () =>
      import('./features/tools/team-builder/team-builder-page.component').then(
        (module) => module.TeamBuilderPageComponent,
      ),
  },
  {
    path: '**',
    redirectTo: 'heroes',
  },
];
