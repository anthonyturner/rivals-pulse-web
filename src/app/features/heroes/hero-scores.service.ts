import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { CommunityHeroScores } from '../../../contracts/hero-scores.model';
import { cachedRetryRequest } from '../../shared/utilities/cached-retry-request';

/** The site's own `/api/community/hero-scores`: the 1 to 10 build scores from RivalsPulse matches. */
@Injectable({ providedIn: 'root' })
export class HeroScoresService {
  private readonly http = inject(HttpClient);
  private readonly loadScores = cachedRetryRequest({
    request: () => this.http.get<unknown>('/api/community/hero-scores'),
    accept: (body) => (isCommunityHeroScores(body) ? body : null),
    failureMessage: 'Failed to load hero scores from /api/community/hero-scores',
  });

  /**
   * The current half-season's scores, or null when the request fails or the answer is not scores.
   * An answer is kept for the life of the app; a failed one is not, so the next caller tries again.
   */
  getHeroScores(): Observable<CommunityHeroScores | null> {
    return this.loadScores();
  }
}

/** Checks the parts the pages read, so a malformed answer becomes the failed state, not a false "collecting". */
export function isCommunityHeroScores(body: unknown): body is CommunityHeroScores {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const scores = body as Partial<Record<keyof CommunityHeroScores, unknown>>;
  const minimums = scores.minimums as Partial<CommunityHeroScores['minimums']> | null | undefined;

  return (
    (scores.status === 'ready' || scores.status === 'not-enough-data') &&
    typeof minimums?.matches === 'number' &&
    typeof minimums.contributors === 'number' &&
    typeof minimums.rankedHeroes === 'number' &&
    Array.isArray(scores.heroes)
  );
}
