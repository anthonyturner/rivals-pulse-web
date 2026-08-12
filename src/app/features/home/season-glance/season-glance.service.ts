import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import type { SeasonGlanceContent } from '../home-content.model';
import { HomeContentService } from '../home-content.service';
import type { SeasonUpdate } from '../home-season.model';
import { HomeTierListService } from '../home-tier-list.service';

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
  private readonly tierLists = inject(HomeTierListService);

  readonly initialState = emptyState;

  getSeasonGlance(): Observable<SeasonGlanceState> {
    return forkJoin({
      content: this.homeContent.getHomeContent(),
      tierList: this.tierLists.getLatestAllRanks(),
    }).pipe(
      map(({ content, tierList }) => {
        const selectedSeason = tierList?.seasons.find(
          (season) => season.id === tierList.selectedSeasonId,
        );

        return {
          content: content.seasonGlance,
          latestTuning: content.latestTuning,
          seasonDateRange: selectedSeason
            ? formatDateRange(selectedSeason.startTime, selectedSeason.endTime)
            : '',
        };
      }),
    );
  }
}

function formatDateRange(startValue: string, endValue: string): string {
  const start = new Date(startValue);
  const end = new Date(endValue);
  const startText = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
  }).format(start);
  const endText = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(end);

  return `${startText} – ${endText}`;
}
