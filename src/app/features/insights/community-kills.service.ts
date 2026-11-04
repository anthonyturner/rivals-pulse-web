import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { CommunityKills } from '../../../contracts/community-kills.model';

/** The site's own `/api/community/kills`: Rivals Pulse kill-feed counters, with no outside request. */
@Injectable({ providedIn: 'root' })
export class CommunityKillsService {
  private readonly http = inject(HttpClient);

  /** The kill-feed counters, or null when the request fails or the answer is not community kills. */
  getKills(): Observable<CommunityKills | null> {
    return this.http.get<unknown>('/api/community/kills').pipe(
      map((body) => (isCommunityKills(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load community kills from /api/community/kills', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a blank panel. */
export function isCommunityKills(body: unknown): body is CommunityKills {
  if (!isRecord(body)) {
    return false;
  }

  const minimums = body['minimums'];

  return (
    (body['status'] === 'ready' || body['status'] === 'not-enough-data') &&
    isRecord(minimums) &&
    typeof minimums['pairMatches'] === 'number' &&
    Number.isFinite(minimums['pairMatches']) &&
    (body['halfSeason'] === null || isRecord(body['halfSeason'])) &&
    (body['inPlaceOf'] === null || isRecord(body['inPlaceOf'])) &&
    Array.isArray(body['pairs']) &&
    body['pairs'].every(isPair)
  );
}

function isPair(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['killer'] === 'string' &&
    typeof value['victim'] === 'string' &&
    typeof value['killsBand'] === 'number' &&
    Number.isFinite(value['killsBand'])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
