import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { HeroSwitchIns } from '../../../contracts/hero-switch-ins.model';

/** The site's own `/api/hero-switch-ins`: RivalsPulse hero switches against the enemy heroes on the field, with no outside request. */
@Injectable({ providedIn: 'root' })
export class HeroSwitchInsService {
  private readonly http = inject(HttpClient);

  /** The switch-ins, or null when the request fails or the answer is not hero switch-ins. */
  getHeroSwitchIns(): Observable<HeroSwitchIns | null> {
    return this.http.get<unknown>('/api/hero-switch-ins').pipe(
      map((body) => (isHeroSwitchIns(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load hero switch-ins from /api/hero-switch-ins', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a blank panel. */
export function isHeroSwitchIns(body: unknown): body is HeroSwitchIns {
  if (!isRecord(body)) {
    return false;
  }

  return (
    (body['status'] === 'ready' || body['status'] === 'not-enough-data') &&
    isCount(body['minimumMatches']) &&
    isCount(body['minimumPlayers']) &&
    (body['halfSeason'] === null || isRecord(body['halfSeason'])) &&
    (body['inPlaceOf'] === null || isRecord(body['inPlaceOf'])) &&
    Array.isArray(body['switchIns']) &&
    body['switchIns'].every(isSwitchIn)
  );
}

function isSwitchIn(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['hero'] === 'string' &&
    typeof value['enemy'] === 'string' &&
    ['matches', 'switches', 'wins', 'winRate'].every((key) => isCount(value[key])) &&
    (value['overall'] === null || isOverall(value['overall']))
  );
}

function isOverall(value: unknown): boolean {
  return isRecord(value) && ['matches', 'appearances', 'wins', 'winRate'].every((key) => isCount(value[key]));
}

function isCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
