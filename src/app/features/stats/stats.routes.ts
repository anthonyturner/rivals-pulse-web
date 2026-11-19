import type { Type } from '@angular/core';
import type { Route, Routes } from '@angular/router';

import { ROUTE_DESCRIPTION_KEY } from '../../core/seo/page-meta-title.strategy';
import { DEFAULT_STATS_TAB, STATS_TAB_DATA_KEY, STATS_TABS, statsTabTitle, type StatsTab, type StatsTabId } from './stats-tabs';

/** What each tab shows. Roles, Matchups and Team comps are the community and insight views, with no page of their own around them. */
const TAB_COMPONENTS: Record<StatsTabId, () => Promise<Type<unknown>>> = {
  overview: () => import('./stats-overview/stats-overview.component').then((module) => module.StatsOverviewComponent),
  heroes: () => import('./stats-heroes/stats-heroes.component').then((module) => module.StatsHeroesComponent),
  roles: () => import('../community/stats-tab/stats-tab.component').then((module) => module.StatsTabComponent),
  matchups: () => import('../community/counters-tab/counters-tab.component').then((module) => module.CountersTabComponent),
  maps: () => import('./stats-maps/stats-maps.component').then((module) => module.StatsMapsComponent),
  'team-comps': () => import('../insights/team-comps/team-comps.component').then((module) => module.TeamCompsComponent),
  records: () => import('./stats-records/stats-records.component').then((module) => module.StatsRecordsComponent),
};

function tabRoute(tab: StatsTab): Route {
  return {
    path: tab.path,
    title: statsTabTitle(tab),
    data: { [STATS_TAB_DATA_KEY]: tab.id, [ROUTE_DESCRIPTION_KEY]: tab.description },
    loadComponent: TAB_COMPONENTS[tab.id],
  };
}

/**
 * One child route per tab under one page, so the tab bar stays put between tabs. Each tab has its own
 * address, title and description. An address that names no tab matches none of these and reaches the
 * not-found page.
 */
export const statsRoutes: Routes = [
  {
    path: '',
    // Every tab sets its own title; this is the one a tab without its own would show.
    title: statsTabTitle(DEFAULT_STATS_TAB),
    loadComponent: () => import('./stats-page/stats-page.component').then((module) => module.StatsPageComponent),
    children: STATS_TABS.map(tabRoute),
  },
];
