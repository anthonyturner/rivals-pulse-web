import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { HeroStats, HeroStatsMode, HeroStatsModeId } from '../../../contracts/hero-stats.model';
import { DEFAULT_MODE_ID } from '../../shared/utilities/play-modes';

/** The site's own `/api/hero-stats`: Rivals Pulse match numbers, with no outside request. */
@Injectable({ providedIn: 'root' })
export class HeroStatsService {
  private readonly http = inject(HttpClient);

  /**
   * The hero stats of the current half-season (or the previous one standing in for it), or of
   * exactly `halfSeason`, counting the Quick Match and Competitive blend or, with `mode`, that mode
   * alone. The blend is asked for with no `mode`, so it shares the default request's cached answer.
   * Null when the request fails or the answer is not hero stats.
   */
  getHeroStats(halfSeason?: number, mode?: HeroStatsModeId): Observable<HeroStats | null> {
    const params = {
      ...(halfSeason === undefined ? {} : { halfSeason }),
      ...(mode === undefined || mode === DEFAULT_MODE_ID ? {} : { mode }),
    };

    return this.http.get<unknown>('/api/hero-stats', { params }).pipe(
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
    Array.isArray(stats.halfSeasons) &&
    Array.isArray(stats.tiers) &&
    stats.tiers.every((tier) => Array.isArray((tier as { heroes?: unknown } | null)?.heroes)) &&
    Array.isArray(stats.belowMinimum) &&
    (stats.halfSeason === null || typeof stats.halfSeason === 'object') &&
    (stats.inPlaceOf === null || typeof stats.inPlaceOf === 'object') &&
    (stats.modes === undefined || (Array.isArray(stats.modes) && stats.modes.every(isMode)))
  );
}

/** `modes` is absent in an answer cached before it existed, so only a present one is checked. */
function isMode(value: unknown): boolean {
  const mode = value as Partial<Record<keyof HeroStatsMode, unknown>> | null;

  return (
    typeof mode === 'object' &&
    mode !== null &&
    typeof mode.id === 'string' &&
    typeof mode.label === 'string' &&
    typeof mode.decidedMatches === 'number' &&
    Number.isFinite(mode.decidedMatches)
  );
}
