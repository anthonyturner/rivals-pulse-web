import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import type { SeasonDashboardContent } from '../home-content.model';
import { HomeContentService } from '../home-content.service';
import type { SeasonHighlight, SeasonUpdate } from '../home-season.model';

export interface SeasonDashboardState {
  content: SeasonDashboardContent | null;
  seasonUpdates: readonly SeasonUpdate[];
  seasonEvents: readonly SeasonHighlight[];
}

const emptyState: SeasonDashboardState = {
  content: null,
  seasonUpdates: [],
  seasonEvents: [],
};

@Injectable({ providedIn: 'root' })
export class SeasonDashboardService {
  private readonly homeContent = inject(HomeContentService);

  readonly initialState = emptyState;

  getSeasonDashboard(): Observable<SeasonDashboardState> {
    return this.homeContent.getHomeContent().pipe(
      map((content) => ({
        content: content.seasonDashboard,
        seasonUpdates: content.seasonUpdates,
        seasonEvents: content.seasonEvents,
      })),
    );
  }
}
