import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import { HeroDataService } from '../../heroes/hero-data.service';
import { heroIdentities } from '../../insights/hero-identity';
import type { SeasonDashboardContent } from '../home-content.model';
import { HomeContentService } from '../home-content.service';
import { HomeHeroStatsService } from '../home-hero-stats.service';
import type { SeasonHighlight, SeasonUpdate } from '../home-season.model';
import { buildHeroUsageView, type HeroUsageView } from '../sections/hero-usage-section/hero-usage-view';

export interface SeasonDashboardState {
  content: SeasonDashboardContent | null;
  seasonUpdates: readonly SeasonUpdate[];
  seasonEvents: readonly SeasonHighlight[];
  heroUsage: HeroUsageView;
}

const emptyState: SeasonDashboardState = {
  content: null,
  seasonUpdates: [],
  seasonEvents: [],
  heroUsage: buildHeroUsageView(null, new Map()),
};

@Injectable({ providedIn: 'root' })
export class SeasonDashboardService {
  private readonly homeContent = inject(HomeContentService);
  private readonly heroStats = inject(HomeHeroStatsService);
  private readonly heroData = inject(HeroDataService);

  readonly initialState = emptyState;

  getSeasonDashboard(): Observable<SeasonDashboardState> {
    return forkJoin({
      content: this.homeContent.getHomeContent(),
      stats: this.heroStats.getHeroStats(),
      heroes: this.heroData.getHeroes(),
    }).pipe(
      map(({ content, stats, heroes }) => ({
        content: content.seasonDashboard,
        seasonUpdates: content.seasonUpdates,
        seasonEvents: content.seasonEvents,
        heroUsage: buildHeroUsageView(stats, heroIdentities(heroes)),
      })),
    );
  }
}
