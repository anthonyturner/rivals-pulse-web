import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { CommunityMatches } from '../../../../contracts/community-matches.model';

/** The site's own `/api/community/matches`: anonymous match totals, with no outside request. */
@Injectable({ providedIn: 'root' })
export class CommunityMatchesService {
  private readonly http = inject(HttpClient);

  /** The community match figures, or null when the request fails or the answer is not that. */
  getMatches(): Observable<CommunityMatches | null> {
    return this.http.get<unknown>('/api/community/matches').pipe(
      map((body) => (isCommunityMatches(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load community matches from /api/community/matches', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the tab reads, so a malformed answer becomes the failed state, not a blank panel. */
export function isCommunityMatches(body: unknown): body is CommunityMatches {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const data = body as Partial<Record<keyof CommunityMatches, unknown>>;
  const minimums = data.minimums as Partial<Record<string, unknown>> | null | undefined;

  return (
    (data.status === 'ready' || data.status === 'not-enough-data') &&
    typeof minimums === 'object' &&
    minimums !== null &&
    ['overviewMatches', 'mapMatches', 'lengthMatches', 'recorders'].every((key) => isCount(minimums[key])) &&
    (data.matchesBand === null || isCount(data.matchesBand)) &&
    (data.halfSeason === null || isHalfSeason(data.halfSeason)) &&
    (data.inPlaceOf === null || isHalfSeason(data.inPlaceOf)) &&
    isListOf(data.maps, (row) => isString(row['map']) && isCount(row['winRate'])) &&
    Array.isArray(data.mapsBelowMinimum) &&
    data.mapsBelowMinimum.every(isString) &&
    (data.modeMix === null ||
      isListOf(
        data.modeMix,
        (row) =>
          isString(row['mode']) &&
          isCount(row['share']) &&
          (row['averageLengthMinutes'] === null || isCount(row['averageLengthMinutes'])),
      )) &&
    (data.averageLengthMinutes === null || isCount(data.averageLengthMinutes)) &&
    (data.perDay === null || isListOf(data.perDay, (row) => isString(row['day']) && isCount(row['share'])))
  );
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return isNumber(value) && value >= 0;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isHalfSeason(value: unknown): boolean {
  const season = value as Partial<Record<string, unknown>> | null;

  return typeof season === 'object' && season !== null && isString(season['label']);
}

function isListOf(value: unknown, isRow: (row: Record<string, unknown>) => boolean): boolean {
  return (
    Array.isArray(value) &&
    value.every((row) => typeof row === 'object' && row !== null && isRow(row as Record<string, unknown>))
  );
}
