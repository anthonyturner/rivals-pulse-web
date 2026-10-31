import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { HeroMatchups } from '../../../contracts/hero-matchups.model';

/** The site's own `/api/hero-matchups`: Rivals Pulse match records, with no outside request. */
@Injectable({ providedIn: 'root' })
export class HeroMatchupsService {
  private readonly http = inject(HttpClient);

  /** The matchups, or null when the request fails or the answer is not hero matchups. */
  getHeroMatchups(): Observable<HeroMatchups | null> {
    return this.http.get<unknown>('/api/hero-matchups').pipe(
      map((body) => (isHeroMatchups(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load hero matchups from /api/hero-matchups', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a blank panel. */
export function isHeroMatchups(body: unknown): body is HeroMatchups {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const matchups = body as Partial<Record<keyof HeroMatchups, unknown>>;

  return (
    (matchups.status === 'ready' || matchups.status === 'not-enough-data') &&
    typeof matchups.minimumMatches === 'number' &&
    (matchups.halfSeason === null || typeof matchups.halfSeason === 'object') &&
    (matchups.inPlaceOf === null || typeof matchups.inPlaceOf === 'object') &&
    Array.isArray(matchups.matchups) &&
    matchups.matchups.every(isReadableMatchup)
  );
}

function isReadableMatchup(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const matchup = entry as Record<string, unknown>;

  return (
    typeof matchup['hero'] === 'string' &&
    typeof matchup['enemy'] === 'string' &&
    ['matches', 'appearances', 'wins', 'winRate', 'shrunkWinRate'].every(
      (key) => typeof matchup[key] === 'number' && Number.isFinite(matchup[key]),
    )
  );
}
