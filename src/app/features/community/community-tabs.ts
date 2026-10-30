import type { Type } from '@angular/core';
import type { UrlMatcher } from '@angular/router';

import { CountersTabComponent } from './counters-tab/counters-tab.component';
import { HeroesTabComponent } from './heroes-tab/heroes-tab.component';
import { InsightsTabComponent } from './insights-tab/insights-tab.component';
import { MatchesTabComponent } from './matches-tab/matches-tab.component';
import { StatsTabComponent } from './stats-tab/stats-tab.component';
import { TierListTabComponent } from './tier-list-tab/tier-list-tab.component';

export interface CommunityTab {
  id: string;
  label: string;
  component: Type<unknown>;
}

/** The order mirrors the Rivals Pulse desktop app's screens. */
export const COMMUNITY_TABS: readonly CommunityTab[] = [
  { id: 'heroes', label: 'Heroes', component: HeroesTabComponent },
  { id: 'matches', label: 'Matches', component: MatchesTabComponent },
  { id: 'counters', label: 'Counters', component: CountersTabComponent },
  { id: 'tier-list', label: 'Tier list', component: TierListTabComponent },
  { id: 'stats', label: 'Stats', component: StatsTabComponent },
  { id: 'insights', label: 'Insights', component: InsightsTabComponent },
];

export const DEFAULT_COMMUNITY_TAB_ID = COMMUNITY_TABS[0].id;

/** Matches a single URL segment that names a tab and exposes it as the `tab` param. */
export const communityTabMatcher: UrlMatcher = (segments) => {
  const [segment] = segments;
  const isTab = segments.length === 1 && COMMUNITY_TABS.some((tab) => tab.id === segment.path);
  return isTab ? { consumed: segments, posParams: { tab: segment } } : null;
};
