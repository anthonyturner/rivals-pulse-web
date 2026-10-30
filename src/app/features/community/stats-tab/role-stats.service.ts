import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { RoleStats } from '../../../../contracts/role-stats.model';

/** The site's own `/api/community/stats`: Rivals Pulse match numbers, with no outside request. */
@Injectable({ providedIn: 'root' })
export class RoleStatsService {
  private readonly http = inject(HttpClient);

  /** The role stats, or null when the request fails or the answer is not role stats. */
  getRoleStats(): Observable<RoleStats | null> {
    return this.http.get<unknown>('/api/community/stats').pipe(
      map((body) => (isRoleStats(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load role stats from /api/community/stats', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the tab reads, so a malformed answer becomes the failed state, not a blank panel. */
export function isRoleStats(body: unknown): body is RoleStats {
  if (!isRecord(body)) {
    return false;
  }

  return (
    (body['status'] === 'ready' || body['status'] === 'not-enough-data') &&
    typeof body['minimumLines'] === 'number' &&
    Number.isFinite(body['minimumLines']) &&
    Array.isArray(body['modes']) &&
    body['modes'].every(isMode) &&
    (body['halfSeason'] === null || isRecord(body['halfSeason'])) &&
    (body['inPlaceOf'] === null || isRecord(body['inPlaceOf']))
  );
}

function isMode(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['label'] === 'string' &&
    Array.isArray(value['roles']) &&
    value['roles'].every(isRole)
  );
}

function isRole(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['role'] === 'string' &&
    (value['status'] === 'ready' || value['status'] === 'not-enough-data') &&
    typeof value['appearances'] === 'number' &&
    Number.isFinite(value['appearances'])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
