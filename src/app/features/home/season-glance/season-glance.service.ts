import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import type { TierListHero, TierListResponse } from '../../../../contracts/tier-list.model';
import type { SeasonGlanceContent } from '../home-content.model';
import { HomeContentService } from '../home-content.service';
import { HomeTierListService } from '../home-tier-list.service';

export interface SeasonTopPick {
  name: string;
  role: string;
  imageUrl: string;
  /** Percentage, as the tier list reports it. */
  pickRate: number;
}

export interface SeasonGlanceState {
  content: SeasonGlanceContent | null;
  topPick: SeasonTopPick | null;
  seasonDateRange: string;
}

const emptyState: SeasonGlanceState = {
  content: null,
  topPick: null,
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
          topPick: findTopPick(tierList),
          seasonDateRange: selectedSeason
            ? formatDateRange(selectedSeason.startTime, selectedSeason.endTime)
            : '',
        };
      }),
    );
  }
}

/**
 * The most-picked hero across every tier, at all ranks.
 *
 * The week-over-week delta the design shows alongside this is not derivable yet:
 * the tier list keeps one row per hero and the sync overwrites it, so there is
 * no earlier figure to compare against. It arrives with the rate history work.
 */
function findTopPick(tierList: TierListResponse | null): SeasonTopPick | null {
  const heroes: TierListHero[] = (tierList?.tiers ?? []).flatMap((tier) => tier.heroes);

  if (heroes.length === 0) {
    return null;
  }

  const top = heroes.reduce((best, hero) => (hero.pickRate > best.pickRate ? hero : best));

  return {
    name: top.name,
    role: top.role,
    imageUrl: top.imageUrl,
    pickRate: top.pickRate,
  };
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
