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

/** Checks the parts the page reads, so a malformed answer becomes the saved snapshot, not a blank table or a thrown error. */
export function isGameStats(body: unknown): body is GameStatsResponse {
  if (!isRecord(body)) {
    return false;
  }

  return (
    typeof body['snapshotDate'] === 'string' &&
    typeof body['fetchedAt'] === 'string' &&
    (body['previousSnapshot'] === undefined ||
      (isRecord(body['previousSnapshot']) && typeof body['previousSnapshot']['capturedAt'] === 'string')) &&
    Array.isArray(body['games']) &&
    body['games'].every(isGame)
  );
}

const COMPARED_COUNTS = ['currentPlayers', 'dailyPeak', 'allTimePeak'];
const COMPARED_RANKS = ['steamDailyRank', 'topSellerRank'];

function isGame(game: unknown): boolean {
  if (!isRecord(game)) {
    return false;
  }

  const comparison = game['comparison'];

  return (
    typeof game['name'] === 'string' &&
    typeof game['category'] === 'string' &&
    COMPARED_COUNTS.every((key) => Number.isFinite(game[key])) &&
    COMPARED_RANKS.every((key) => typeof game[key] === 'string') &&
    (comparison === undefined ||
      (isRecord(comparison) &&
        COMPARED_COUNTS.every((key) => isRecord(comparison[key])) &&
        COMPARED_RANKS.every((key) => isRecord(comparison[key]))))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
