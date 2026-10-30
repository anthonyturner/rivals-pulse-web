import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { HeroStats } from '../../../contracts/hero-stats.model';

/** The site's own `/api/hero-stats`: Rivals Pulse match numbers, with no outside request. */
@Injectable({ providedIn: 'root' })
export class HeroStatsService {
  private readonly http = inject(HttpClient);

  /** The hero stats, or null when the request fails or the answer is not hero stats. */
  getHeroStats(): Observable<HeroStats | null> {
    return this.http.get<unknown>('/api/hero-stats').pipe(
      map((body) => (isHeroStats(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load hero stats from /api/hero-stats', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a blank panel. */
export function isHeroStats(body: unknown): body is HeroStats {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const stats = body as Partial<Record<keyof HeroStats, unknown>>;

  return (
    (stats.status === 'ready' || stats.status === 'not-enough-data') &&
    typeof stats.minimumMatches === 'number' &&
    typeof stats.matchesCounted === 'number' &&
    Number.isFinite(stats.matchesCounted) &&
    Array.isArray(stats.tiers) &&
    stats.tiers.every((tier) => Array.isArray((tier as { heroes?: unknown } | null)?.heroes)) &&
    Array.isArray(stats.belowMinimum) &&
    (stats.halfSeason === null || typeof stats.halfSeason === 'object') &&
    (stats.inPlaceOf === null || typeof stats.inPlaceOf === 'object')
  );
}
