import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { GameStatsResponse } from '../../../../contracts/game-stats.model';

/** The site's own `/api/game-stats`: Steam player counts for Marvel Rivals and the games it is compared with. */
@Injectable({ providedIn: 'root' })
export class GameStatsService {
  private readonly http = inject(HttpClient);

  /** Null when the request fails or the answer is not game stats. */
  getGameStats(): Observable<GameStatsResponse | null> {
    return this.http.get<unknown>('/api/game-stats').pipe(
      map((body) => (isGameStats(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load live game stats from /api/game-stats', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the page reads, so a malformed answer becomes the saved snapshot, not a blank table. */
export function isGameStats(body: unknown): body is GameStatsResponse {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const stats = body as Partial<GameStatsResponse>;

  return (
    typeof stats.snapshotDate === 'string' &&
    typeof stats.fetchedAt === 'string' &&
    Array.isArray(stats.games)
  );
}
