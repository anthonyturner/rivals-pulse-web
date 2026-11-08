import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { HeroStatsService } from './hero-stats.service';

/**
 * The current hero stats (the default half-season and mode), fetched once and kept for the life of
 * the app however many pages or sections ask. For a half-season or mode the caller chooses, use
 * `HeroStatsService` directly.
 */
@Injectable({ providedIn: 'root' })
export class CurrentHeroStatsService {
  private readonly heroStats = inject(HeroStatsService);
  private readonly stats$ = this.heroStats.getHeroStats().pipe(shareReplay({ bufferSize: 1, refCount: false }));

  /** The current hero stats, or null when they could not be read. */
  getHeroStats(): Observable<HeroStats | null> {
    return this.stats$;
  }
}
