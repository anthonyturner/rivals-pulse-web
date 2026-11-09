import type { Type } from '@angular/core';
import type { CanMatchFn } from '@angular/router';

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

/** The order mirrors the RivalsPulse desktop app's screens. */
export const COMMUNITY_TABS: readonly CommunityTab[] = [
  { id: 'heroes', label: 'Heroes', component: HeroesTabComponent },
  { id: 'matches', label: 'Matches', component: MatchesTabComponent },
  { id: 'counters', label: 'Counters', component: CountersTabComponent },
  { id: 'tier-list', label: 'Tier list', component: TierListTabComponent },
  { id: 'stats', label: 'Stats', component: StatsTabComponent },
  { id: 'insights', label: 'Insights', component: InsightsTabComponent },
];

export const DEFAULT_COMMUNITY_TAB_ID = COMMUNITY_TABS[0].id;

/** Lets the `:tab` route match only an address that names one of the tabs. */
export const isCommunityTab: CanMatchFn = (_route, segments) =>
  segments.length === 1 && COMMUNITY_TABS.some((tab) => tab.id === segments[0].path);
