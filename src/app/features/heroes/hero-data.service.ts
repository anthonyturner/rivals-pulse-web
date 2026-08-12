import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

import { Hero, HeroVideo } from './hero.model';

@Injectable({ providedIn: 'root' })
export class HeroDataService {
  private readonly http = inject(HttpClient);

  getHeroes(): Observable<Hero[]> {
    return this.http.get<Hero[]>('/api/heroes').pipe(
      catchError((error) => {
        console.error('Failed to load hero data from /api/heroes', error);

        return of([]);
      }),
    );
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
