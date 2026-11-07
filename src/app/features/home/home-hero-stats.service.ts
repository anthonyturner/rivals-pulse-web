import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { HeroStatsService } from '../insights/hero-stats.service';

/** The hero stats the home page's sections share, fetched once however many of them ask. */
@Injectable({ providedIn: 'root' })
export class HomeHeroStatsService {
  private readonly heroStats = inject(HeroStatsService);
  private readonly stats$ = this.heroStats.getHeroStats().pipe(shareReplay({ bufferSize: 1, refCount: false }));

  /** The current hero stats, or null when they could not be read. */
  getHeroStats(): Observable<HeroStats | null> {
    return this.stats$;
  }
}
