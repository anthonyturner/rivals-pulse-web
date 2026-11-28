import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { HeroStatsModeId } from '../../../contracts/hero-stats.model';
import type { TripleSupportTrios } from '../../../contracts/triple-support-trios.model';
import { hasReadableScope, statsQueryParams } from './stats-scope';

/** The site's own `/api/triple-support-trios`: RivalsPulse match records, with no outside request. */
@Injectable({ providedIn: 'root' })
export class TripleSupportTriosService {
  private readonly http = inject(HttpClient);

  /**
   * The trios of the current half-season (or the previous one standing in for it), or of exactly
   * `halfSeason`, in the Quick Match and Competitive blend or, with `mode`, that mode alone. Null
   * when the request fails or the answer is not triple-support trios.
   */
  getTripleSupportTrios(halfSeason?: number, mode?: HeroStatsModeId): Observable<TripleSupportTrios | null> {
    return this.http
      .get<unknown>('/api/triple-support-trios', { params: statsQueryParams(halfSeason, mode) })
      .pipe(
        map((body) => (isTripleSupportTrios(body) ? body : null)),
        catchError((error: unknown) => {
          console.error('Failed to load triple-support trios from /api/triple-support-trios', error);

          return of(null);
        }),
      );
  }
}

/** Checks the parts the page reads, so a malformed answer becomes the failed state, not a blank panel. */
export function isTripleSupportTrios(body: unknown): body is TripleSupportTrios {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const trios = body as Partial<Record<keyof TripleSupportTrios, unknown>>;

  return (
    (trios.status === 'ready' || trios.status === 'not-enough-data') &&
    ['minimumMatches', 'classifiedTeams', 'unclassifiedTeams', 'fourPlusTeams'].every((key) =>
      isFiniteNumber((trios as Record<string, unknown>)[key]),
    ) &&
    (trios.halfSeason === null || typeof trios.halfSeason === 'object') &&
    (trios.inPlaceOf === null || typeof trios.inPlaceOf === 'object') &&
    hasReadableScope(trios) &&
    Array.isArray(trios.trios) &&
    trios.trios.every(isReadableTrio)
  );
}

function isReadableTrio(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const trio = entry as Record<string, unknown>;
  const variant = trio['variant'] as Record<string, unknown> | null;

  return (
    Array.isArray(trio['heroes']) &&
    trio['heroes'].length === 3 &&
    trio['heroes'].every((hero) => typeof hero === 'string') &&
    typeof variant === 'object' &&
    variant !== null &&
    typeof variant['label'] === 'string' &&
    ['matches', 'teams', 'wins', 'share'].every((key) => isFiniteNumber(trio[key]))
  );
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}
