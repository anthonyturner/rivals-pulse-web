import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { HeroStatsModeId } from '../../../contracts/hero-stats.model';
import { TEAM_LINEUP_DEFAULT_MODE_ID, type TeamLineups } from '../../../contracts/team-lineups.model';
import { hasReadableScope, statsQueryParams } from './stats-scope';

/** The site's own `/api/team-lineups`: RivalsPulse match records, with no outside request. */
@Injectable({ providedIn: 'root' })
export class TeamLineupsService {
  private readonly http = inject(HttpClient);

  /**
   * The line-ups of the current half-season (or the previous one standing in for it), or of exactly
   * `halfSeason`, in Competitive or, with `mode`, that mode alone. Null when the request fails or the
   * answer is not team line-ups.
   */
  getTeamLineups(halfSeason?: number, mode?: HeroStatsModeId): Observable<TeamLineups | null> {
    return this.http
      .get<unknown>('/api/team-lineups', { params: statsQueryParams(halfSeason, mode, TEAM_LINEUP_DEFAULT_MODE_ID) })
      .pipe(
        map((body) => (isTeamLineups(body) ? body : null)),
        catchError((error: unknown) => {
          console.error('Failed to load team line-ups from /api/team-lineups', error);

          return of(null);
        }),
      );
  }
}

/** Checks the parts the page reads, so a malformed answer becomes the failed state, not a blank panel. */
export function isTeamLineups(body: unknown): body is TeamLineups {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const lineups = body as Partial<Record<keyof TeamLineups, unknown>>;

  return (
    (lineups.status === 'ready' || lineups.status === 'not-enough-data') &&
    ['minimumTeams', 'classifiedTeams', 'unclassifiedTeams'].every((key) =>
      isCount((lineups as Record<string, unknown>)[key]),
    ) &&
    (lineups.halfSeason === null || typeof lineups.halfSeason === 'object') &&
    (lineups.inPlaceOf === null || typeof lineups.inPlaceOf === 'object') &&
    hasReadableScope(lineups) &&
    Array.isArray(lineups.shapes) &&
    lineups.shapes.every(isReadableShape)
  );
}

function isReadableShape(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) {
    return false;
  }

  const shape = entry as Record<string, unknown>;

  return (
    ['vanguards', 'duelists', 'strategists'].every((key) => isCount(shape[key])) &&
    (shape['status'] === 'ready' || shape['status'] === 'not-enough-data') &&
    ['teams', 'wins', 'pickRate', 'winRate'].every((key) => shape[key] === null || isFiniteNumber(shape[key]))
  );
}

function isCount(value: unknown): boolean {
  return isFiniteNumber(value) && (value as number) >= 0;
}

function isFiniteNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value);
}
