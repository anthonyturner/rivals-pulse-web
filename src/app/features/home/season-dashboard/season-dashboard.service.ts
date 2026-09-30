import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import type { TierListHero } from '../../../../contracts/tier-list.model';
import type { SeasonDashboardContent } from '../home-content.model';
import { HomeContentService } from '../home-content.service';
import type { SeasonHighlight, SeasonUpdate } from '../home-season.model';
import { HomeTierListService } from '../home-tier-list.service';

export interface SeasonDashboardState {
  content: SeasonDashboardContent | null;
  seasonUpdates: readonly SeasonUpdate[];
  seasonEvents: readonly SeasonHighlight[];
  mostPickedHeroes: readonly TierListHero[];
  metaUpdatedLabel: string;
  heroSourceLabel: string;
  heroSourceUrl: string;
}

const emptyState: SeasonDashboardState = {
  content: null,
  seasonUpdates: [],
  seasonEvents: [],
  mostPickedHeroes: [],
  metaUpdatedLabel: '',
  heroSourceLabel: '',
  heroSourceUrl: '',
};

@Injectable({ providedIn: 'root' })
export class SeasonDashboardService {
  private readonly homeContent = inject(HomeContentService);
  private readonly tierLists = inject(HomeTierListService);

  readonly initialState = emptyState;

  getSeasonDashboard(): Observable<SeasonDashboardState> {
    return forkJoin({
      content: this.homeContent.getHomeContent(),
      tierList: this.tierLists.getLatestAllRanks(),
    }).pipe(
      map(({ content, tierList }) => {
        const selectedSeason = tierList?.seasons.find(
          (season) => season.id === tierList.selectedSeasonId,
        );
        const mostPickedHeroes = tierList && selectedSeason
          ? tierList.tiers
              .flatMap((tier) => tier.heroes)
              .sort((first, second) => second.pickRate - first.pickRate)
              .slice(0, 5)
          : [];

        return {
          content: content.seasonDashboard,
          seasonUpdates: content.seasonUpdates,
          seasonEvents: content.seasonEvents,
          mostPickedHeroes,
          metaUpdatedLabel: tierList?.updatedAt ? formatDate(tierList.updatedAt) : '',
          heroSourceLabel: tierList?.sourceName ?? '',
          heroSourceUrl: tierList?.sourceUrl ?? '',
        };
      }),
    );
  }
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
}
