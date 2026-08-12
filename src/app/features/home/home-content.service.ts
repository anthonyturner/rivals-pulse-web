import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';

import { HomeContent } from './home-content.model';

@Injectable({ providedIn: 'root' })
export class HomeContentService {
  private readonly http = inject(HttpClient);
  private readonly contentSourceUrl = '/api/home/content';

  readonly fallbackContent: HomeContent = {
    heroStats: [],
    portals: [],
    latestNews: [],
    featuredGuides: [],
    quickLinks: [],
    currentFocusTitle: 'Rivals Pulse Coach',
    currentFocusDescription:
      'Connect the Turso content database to load the latest site content.',
    lastChecked: 'Not loaded',
    seasonUpdates: [],
    latestTuning: null,
    seasonEvents: [],
    seasonEventsSourceUrl: '',
    seasonDashboard: null,
    seasonGlance: null,
    sourceMode: 'fallback',
  };

  private readonly homeContent$ = this.http.get<Partial<HomeContent>>(this.contentSourceUrl).pipe(
    map((content) => ({
      ...this.fallbackContent,
      ...content,
      sourceMode: 'database' as const,
    })),
    catchError(() => of(this.fallbackContent)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  /** Loads landing-page content from the cached official-site snapshot stored in the content database. */
  getHomeContent(): Observable<HomeContent> {
    return this.homeContent$;
  }
}
