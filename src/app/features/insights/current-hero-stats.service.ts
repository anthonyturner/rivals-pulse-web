import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { cachedNullableRequest } from '../../shared/utilities/cached-retry-request';
import { HeroStatsService } from './hero-stats.service';

/**
 * The current hero stats (the default half-season and mode), fetched once and kept for the life of
 * the app however many pages or sections ask. For a half-season or mode the caller chooses, use
 * `HeroStatsService` directly. A failed read is not kept: the next ask tries again, so a page that
 * says "try again in a few minutes" is not stuck on the failure.
 */
@Injectable({ providedIn: 'root' })
export class CurrentHeroStatsService {
  private readonly heroStats = inject(HeroStatsService);
  private readonly read = cachedNullableRequest(() => this.heroStats.getHeroStats());

  /** The current hero stats, or null when they could not be read. */
  getHeroStats(): Observable<HeroStats | null> {
    return this.read();
  }
}
