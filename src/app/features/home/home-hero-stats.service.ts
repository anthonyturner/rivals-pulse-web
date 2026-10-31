import { inject, Injectable } from '@angular/core';
import { BehaviorSubject, Observable, shareReplay, switchMap } from 'rxjs';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { HeroStatsService } from '../insights/hero-stats.service';

/** The hero stats the home page's sections share, fetched once however many of them ask. */
@Injectable({ providedIn: 'root' })
export class HomeHeroStatsService {
  private readonly heroStats = inject(HeroStatsService);
  private readonly refresh = new BehaviorSubject<void>(undefined);
  private readonly stats$ = this.refresh.pipe(
    switchMap(() => this.heroStats.getHeroStats()),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** The current hero stats, or null when they could not be read. A reload emits the new answer to every listener. */
  getHeroStats(): Observable<HeroStats | null> {
    return this.stats$;
  }

  /** Asks again, for a section whose stats could not be read. */
  reload(): void {
    this.refresh.next();
  }
}
