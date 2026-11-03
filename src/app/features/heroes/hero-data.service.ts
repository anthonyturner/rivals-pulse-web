import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';

import { Hero, HeroVideo } from './hero.model';

@Injectable({ providedIn: 'root' })
export class HeroDataService {
  private readonly http = inject(HttpClient);
  private roster$: Observable<Hero[] | null> | null = null;

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
    this.roster$ ??= this.http.get<Hero[]>('/api/heroes').pipe(
      map((heroes) => (heroes.length > 0 ? heroes : null)),
      catchError((error) => {
        console.error('Failed to load hero data from /api/heroes', error);

        return of(null);
      }),
      tap((roster) => {
        if (roster === null) {
          this.roster$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.roster$;
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
