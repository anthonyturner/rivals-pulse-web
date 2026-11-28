import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { GameCounts } from '../../../../contracts/game-counts.model';

/** The site's own `/api/game-stats`: the matches and players the RivalsPulse app has seen. */
@Injectable({ providedIn: 'root' })
export class GameStatsService {
  private readonly http = inject(HttpClient);

  /** Null when the request fails or the answer is not game counts. */
  getGameCounts(): Observable<GameCounts | null> {
    return this.http.get<unknown>('/api/game-stats').pipe(
      map((body) => (isGameCounts(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load the game counts from /api/game-stats', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the page reads, so a malformed answer becomes the error panel, not a blank table or a thrown error. */
export function isGameCounts(body: unknown): body is GameCounts {
  if (!isRecord(body)) {
    return false;
  }

  return (
    Number.isFinite(body['matches']) &&
    Number.isFinite(body['players']) &&
    (body['since'] === null || (typeof body['since'] === 'string' && !Number.isNaN(Date.parse(body['since'])))) &&
    Array.isArray(body['halfSeasons']) &&
    body['halfSeasons'].every(
      (season) =>
        isRecord(season) &&
        Number.isFinite(season['halfSeason']) &&
        Number.isFinite(season['matches']) &&
        Number.isFinite(season['players']),
    )
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
