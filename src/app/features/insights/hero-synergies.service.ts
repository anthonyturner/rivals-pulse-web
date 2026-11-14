import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { HeroStatsModeId } from '../../../contracts/hero-stats.model';
import type { HeroSynergies } from '../../../contracts/hero-synergies.model';
import { hasReadableScope, statsQueryParams } from './stats-scope';

/** The site's own `/api/hero-synergies`: RivalsPulse match records, with no outside request. */
@Injectable({ providedIn: 'root' })
export class HeroSynergiesService {
  private readonly http = inject(HttpClient);

  /**
   * The pairs of the current half-season (or the previous one standing in for it), or of exactly
   * `halfSeason`, in the Quick Match and Competitive blend or, with `mode`, that mode alone. Null
   * when the request fails or the answer is not hero synergies.
   */
  getHeroSynergies(halfSeason?: number, mode?: HeroStatsModeId): Observable<HeroSynergies | null> {
    return this.http.get<unknown>('/api/hero-synergies', { params: statsQueryParams(halfSeason, mode) }).pipe(
      map((body) => (isHeroSynergies(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load hero synergies from /api/hero-synergies', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a blank panel. */
export function isHeroSynergies(body: unknown): body is HeroSynergies {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const synergies = body as Partial<Record<keyof HeroSynergies, unknown>>;

  return (
    (synergies.status === 'ready' || synergies.status === 'not-enough-data') &&
    typeof synergies.minimumMatches === 'number' &&
    (synergies.halfSeason === null || typeof synergies.halfSeason === 'object') &&
    (synergies.inPlaceOf === null || typeof synergies.inPlaceOf === 'object') &&
    hasReadableScope(synergies) &&
    Array.isArray(synergies.synergies) &&
    synergies.synergies.every(isReadableSynergy)
  );
}

function isReadableSynergy(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const synergy = entry as Record<string, unknown>;

  return (
    typeof synergy['hero'] === 'string' &&
    typeof synergy['ally'] === 'string' &&
    [synergy['heroRole'], synergy['allyRole']].every((role) => role === undefined || typeof role === 'string') &&
    ['matches', 'appearances', 'wins', 'winRate', 'shrunkWinRate'].every(
      (key) => typeof synergy[key] === 'number' && Number.isFinite(synergy[key]),
    )
  );
}
