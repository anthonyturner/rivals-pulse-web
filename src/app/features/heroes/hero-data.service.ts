import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { cachedRetryRequest } from '../../shared/utilities/cached-retry-request';
import { Hero, HeroVideo } from './hero.model';

@Injectable({ providedIn: 'root' })
export class HeroDataService {
  private readonly http = inject(HttpClient);
  private readonly loadRoster = cachedRetryRequest({
    request: () => this.http.get<Hero[]>('/api/heroes'),
    accept: (heroes) => (heroes.length > 0 ? heroes : null),
    failureMessage: 'Failed to load hero data from /api/heroes',
  });

  /** Every hero, or an empty list when the roster cannot be loaded. */
  getHeroes(): Observable<Hero[]> {
    return this.getHeroRoster().pipe(map((heroes) => heroes ?? []));
  }

  /**
   * Every hero, or `null` when the roster cannot be loaded or comes back empty, for a caller that
   * must tell a missing roster from one that lacks a hero. A roster is kept for the life of the app,
   * so the route check and the page share one request; a missing one is not kept, so the next
   * caller tries again.
   */
  getHeroRoster(): Observable<Hero[] | null> {
    return this.loadRoster();
  }

  getHeroVideos(): Observable<HeroVideo[]> {
    return this.http.get<HeroVideo[]>('/api/hero-videos').pipe(
      catchError((error) => {
        console.error('Failed to load hero videos from /api/hero-videos', error);

        return of([]);
      }),
    );
  }
}
