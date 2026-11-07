import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay, tap } from 'rxjs';

import type { CommunityHeroScores } from '../../../contracts/hero-scores.model';

/** The site's own `/api/community/hero-scores`: the 1 to 10 build scores from RivalsPulse matches. */
@Injectable({ providedIn: 'root' })
export class HeroScoresService {
  private readonly http = inject(HttpClient);
  private scores$: Observable<CommunityHeroScores | null> | null = null;

  /**
   * The current half-season's scores, or null when the request fails or the answer is not scores.
   * An answer is kept for the life of the app; a failed one is not, so the next caller tries again.
   */
  getHeroScores(): Observable<CommunityHeroScores | null> {
    this.scores$ ??= this.http.get<unknown>('/api/community/hero-scores').pipe(
      map((body) => (isCommunityHeroScores(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load hero scores from /api/community/hero-scores', error);

        return of(null);
      }),
      tap((scores) => {
        if (scores === null) {
          this.scores$ = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    return this.scores$;
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a false "collecting". */
export function isCommunityHeroScores(body: unknown): body is CommunityHeroScores {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const scores = body as Partial<Record<keyof CommunityHeroScores, unknown>>;
  const minimums = scores.minimums as Partial<CommunityHeroScores['minimums']> | null | undefined;

  return (
    (scores.status === 'ready' || scores.status === 'not-enough-data') &&
    typeof minimums?.matches === 'number' &&
    typeof minimums.contributors === 'number' &&
    typeof minimums.rankedHeroes === 'number' &&
    Array.isArray(scores.heroes)
  );
}
