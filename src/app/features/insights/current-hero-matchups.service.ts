import { inject, Injectable } from '@angular/core';
import { Observable, shareReplay } from 'rxjs';

import type { HeroMatchups } from '../../../contracts/hero-matchups.model';
import { HeroMatchupsService } from './hero-matchups.service';

/**
 * The hero matchups, fetched once and kept for the life of the app however many previews ask. The
 * pages themselves read `HeroMatchupsService` directly, so they always see a fresh answer.
 */
@Injectable({ providedIn: 'root' })
export class CurrentHeroMatchupsService {
  private readonly matchups$ = inject(HeroMatchupsService)
    .getHeroMatchups()
    .pipe(shareReplay({ bufferSize: 1, refCount: false }));

  /** The matchups, or null when they could not be read. */
  getHeroMatchups(): Observable<HeroMatchups | null> {
    return this.matchups$;
  }
}
