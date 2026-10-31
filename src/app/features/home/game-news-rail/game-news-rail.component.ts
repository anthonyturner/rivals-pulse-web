import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { HomeContent } from '../home-content.model';
import { HomeHeroStatsService } from '../home-hero-stats.service';
import { buildGameNewsView } from './game-news-view';
import { seasonDateRange } from './season-date-range';

/**
 * Every news block of the home page in one labelled aside: the season at a glance, the newest hero,
 * official updates, the season update spotlight and events. The page owns the video, so the
 * spotlight's button only reports that a visitor asked to watch it.
 */
@Component({
  selector: 'app-game-news-rail',
  templateUrl: './game-news-rail.component.html',
  styleUrl: './game-news-rail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GameNewsRailComponent {
  readonly content = input.required<HomeContent>();
  readonly watchVideo = output<void>();

  /** Empty on the server and until the hero stats arrive. */
  private readonly dateRange = signal('');

  protected readonly view = computed(() => buildGameNewsView(this.content(), this.dateRange()));

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(HomeHeroStatsService)
        .getHeroStats()
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe((stats) => {
          // The last half-season is the current one, even while an earlier one stands in for it in the numbers.
          this.dateRange.set(seasonDateRange(stats?.halfSeasons.at(-1)));
        });
    }
  }

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }
}
