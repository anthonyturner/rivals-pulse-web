import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import type { SeasonGlanceContent } from '../home-content.model';
import { HomeContentService } from '../home-content.service';
import { HomeHeroStatsService } from '../home-hero-stats.service';
import type { SeasonUpdate } from '../home-season.model';
import { seasonDateRange } from './season-date-range';

export interface SeasonGlanceState {
  content: SeasonGlanceContent | null;
  latestTuning: SeasonUpdate | null;
  seasonDateRange: string;
}

const emptyState: SeasonGlanceState = {
  content: null,
  latestTuning: null,
  seasonDateRange: '',
};

@Injectable({ providedIn: 'root' })
export class SeasonGlanceService {
  private readonly homeContent = inject(HomeContentService);
  private readonly heroStats = inject(HomeHeroStatsService);

  readonly initialState = emptyState;

  getSeasonGlance(): Observable<SeasonGlanceState> {
    return forkJoin({
      content: this.homeContent.getHomeContent(),
      stats: this.heroStats.getHeroStats(),
    }).pipe(
      map(({ content, stats }) => ({
        content: content.seasonGlance,
        latestTuning: content.latestTuning,
        // The last half-season is the current one, even while an earlier one stands in for it in the numbers.
        seasonDateRange: seasonDateRange(stats?.halfSeasons.at(-1)),
      })),
    );
  }
}
