import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import { PULSE_RECORD_CATEGORIES, type PulseRecords } from '../../../contracts/pulse-records.model';

/**
 * The site's own `/api/records`. The answer is deliberately not kept here: a name must be gone from
 * the page soon after its owner switches naming off, so every visit asks again and the server's
 * 60-second cache is the only copy.
 */
@Injectable({ providedIn: 'root' })
export class PulseRecordsService {
  private readonly http = inject(HttpClient);

  /** The boards, or null when the request fails or the answer is not Pulse Records. */
  getPulseRecords(): Observable<PulseRecords | null> {
    return this.http.get<unknown>('/api/records').pipe(
      map((body) => (isPulseRecords(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load Pulse Records from /api/records', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a blank panel. */
export function isPulseRecords(body: unknown): body is PulseRecords {
  if (!isObject(body)) {
    return false;
  }

  const categories = body['categories'];

  return (
    (body['status'] === 'ready' || body['status'] === 'not-enough-data') &&
    (body['coveredFrom'] === null || typeof body['coveredFrom'] === 'string') &&
    Array.isArray(categories) &&
    PULSE_RECORD_CATEGORIES.every(({ key }) => categories.some((entry: unknown) => isReadableBoard(entry, key)))
  );
}

function isReadableBoard(entry: unknown, key: string): boolean {
  return isObject(entry) && entry['key'] === key && Array.isArray(entry['rows']) && entry['rows'].every(isReadableRow);
}

function isReadableRow(entry: unknown): boolean {
  return (
    isObject(entry) &&
    typeof entry['value'] === 'number' &&
    Number.isFinite(entry['value']) &&
    (entry['hero'] === null || typeof entry['hero'] === 'string') &&
    (entry['name'] === null || typeof entry['name'] === 'string')
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
