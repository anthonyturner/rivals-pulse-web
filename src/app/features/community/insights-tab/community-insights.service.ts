import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';

import type { CommunityInsights } from '../../../../contracts/community-insights.model';

/** The site's own `/api/community/insights`: Rivals Pulse match totals, with no outside request. */
@Injectable({ providedIn: 'root' })
export class CommunityInsightsService {
  private readonly http = inject(HttpClient);

  /** The insights, or null when the request fails or the answer is not community insights. */
  getInsights(): Observable<CommunityInsights | null> {
    return this.http.get<unknown>('/api/community/insights').pipe(
      map((body) => (isCommunityInsights(body) ? body : null)),
      catchError((error: unknown) => {
        console.error('Failed to load community insights from /api/community/insights', error);

        return of(null);
      }),
    );
  }
}

/** Checks the parts the tab reads, so a malformed answer becomes the empty state, not a blank panel. */
export function isCommunityInsights(body: unknown): body is CommunityInsights {
  if (typeof body !== 'object' || body === null) {
    return false;
  }

  const insights = body as Partial<Record<keyof CommunityInsights, unknown>>;

  return (
    (insights.status === 'ready' || insights.status === 'not-enough-data') &&
    typeof insights.minimumMatches === 'number' &&
    typeof insights.minimumRecorders === 'number' &&
    (insights.sessionGapMinutes === null || typeof insights.sessionGapMinutes === 'number') &&
    Array.isArray(insights.dimensions) &&
    insights.dimensions.every(
      (dimension) =>
        typeof dimension === 'object' &&
        dimension !== null &&
        typeof (dimension as { title?: unknown }).title === 'string' &&
        Array.isArray((dimension as { buckets?: unknown }).buckets),
    )
  );
}
