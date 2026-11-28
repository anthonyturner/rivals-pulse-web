import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { HeroMatchups } from '../../../contracts/hero-matchups.model';
import { cachedNullableRequest } from '../../shared/utilities/cached-retry-request';
import { HeroMatchupsService } from './hero-matchups.service';

/**
 * The hero matchups, fetched once and kept for the life of the app however many pages or previews
 * ask. A failed read is not kept: the next ask tries again, so a page that says "try again in a few
 * minutes" is not stuck on the failure.
 */
@Injectable({ providedIn: 'root' })
export class CurrentHeroMatchupsService {
  private readonly heroMatchups = inject(HeroMatchupsService);
  private readonly read = cachedNullableRequest(() => this.heroMatchups.getHeroMatchups());

  /** The matchups, or null when they could not be read. */
  getHeroMatchups(): Observable<HeroMatchups | null> {
    return this.read();
  }
}
