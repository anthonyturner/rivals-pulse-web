import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { CommunityFigures } from '../../../contracts/community-figures.model';

/** The site's own `/api/community/figures`: Rivals Pulse upload numbers, with no outside request. */
@Injectable({ providedIn: 'root' })
export class CommunityFiguresService {
  private readonly http = inject(HttpClient);

  /** The per-minute figures, or null when the request fails or the answer is not community figures. */
  getFigures(): Observable<CommunityFigures | null> {
    return this.http.get<unknown>('/api/community/figures').pipe(
      map((body) => (isCommunityFigures(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load community figures from /api/community/figures', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a blank panel. */
export function isCommunityFigures(body: unknown): body is CommunityFigures {
  if (!isRecord(body)) {
    return false;
  }

  const minimums = body['minimums'];

  return (
    (body['status'] === 'ready' || body['status'] === 'not-enough-data') &&
    isRecord(minimums) &&
    isFiniteNumber(minimums['roleLines']) &&
    isFiniteNumber(minimums['heroLines']) &&
    (body['halfSeason'] === null || isRecord(body['halfSeason'])) &&
    (body['inPlaceOf'] === null || isRecord(body['inPlaceOf'])) &&
    Array.isArray(body['modes']) &&
    body['modes'].every(isMode)
  );
}

function isMode(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['label'] === 'string' &&
    Array.isArray(value['roles']) &&
    value['roles'].every((entry) => isFigures(entry) && typeof entry['role'] === 'string') &&
    Array.isArray(value['heroes']) &&
    value['heroes'].every((entry) => isFigures(entry) && typeof entry['hero'] === 'string')
  );
}

function isFigures(value: unknown): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    ['damage', 'healing', 'blocked'].every((key) => value[key] === null || isFiniteNumber(value[key]))
  );
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
