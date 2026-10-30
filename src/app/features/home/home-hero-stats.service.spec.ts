import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { SeasonDashboardService, type SeasonDashboardState } from './season-dashboard/season-dashboard.service';
import { SeasonGlanceService, type SeasonGlanceState } from './season-glance/season-glance.service';

const ended = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
const ongoing = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const stats: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [ended, ongoing],
  halfSeason: ended,
  inPlaceOf: ongoing,
  matchesCounted: 3,
  tiers: [],
  belowMinimum: [],
};
const home = {
  seasonGlance: { ariaLabel: 'Season 10 at a glance' },
  seasonDashboard: { heroUsage: { eyebrow: 'Season 10 meta', title: 'Most-used heroes' } },
  seasonUpdates: [],
  seasonEvents: [],
  latestTuning: null,
};

describe('the home page sections that use the hero stats', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('dates the season glance from the latest half-season, even while an earlier one stands in', () => {
    let state: SeasonGlanceState | undefined;

    TestBed.inject(SeasonGlanceService)
      .getSeasonGlance()
      .subscribe((value) => (state = value));
    http.expectOne('/api/home/content').flush(home);
    http.expectOne('/api/hero-stats').flush(stats);

    expect(state?.seasonDateRange).toBe('October 9, 2026 – ongoing');
  });

  it('leaves the glance date out, without an error, when the hero stats cannot be read', () => {
    let state: SeasonGlanceState | undefined;

    TestBed.inject(SeasonGlanceService)
      .getSeasonGlance()
      .subscribe((value) => (state = value));
    http.expectOne('/api/home/content').flush(home);
    http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });

    expect(state?.seasonDateRange).toBe('');
    expect(state?.content).not.toBeNull();
  });

  it('asks for the hero stats once for the dashboard and the glance together', () => {
    let dashboard: SeasonDashboardState | undefined;
    let glance: SeasonGlanceState | undefined;

    TestBed.inject(SeasonDashboardService)
      .getSeasonDashboard()
      .subscribe((value) => (dashboard = value));
    TestBed.inject(SeasonGlanceService)
      .getSeasonGlance()
      .subscribe((value) => (glance = value));

    http.expectOne('/api/home/content').flush(home);
    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush(stats);

    expect(dashboard?.heroUsage.state).toBe('empty');
    expect(glance?.seasonDateRange).not.toBe('');
  });

  it('gives the dashboard the not-enough-data hero usage, with the previous season labelled', () => {
    let state: SeasonDashboardState | undefined;

    TestBed.inject(SeasonDashboardService)
      .getSeasonDashboard()
      .subscribe((value) => (state = value));
    http.expectOne('/api/home/content').flush(home);
    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush(stats);

    expect(state?.heroUsage.state).toBe('empty');
    expect(state?.heroUsage.sourceLabel).toBe('Based on Rivals Pulse players · 3 matches · Season 10');
    expect(state?.heroUsage.fallbackNotice).toContain('Season 10.5 does not have enough data yet');
  });

  it('gives the dashboard the unavailable hero usage when the hero stats cannot be read', () => {
    let state: SeasonDashboardState | undefined;

    TestBed.inject(SeasonDashboardService)
      .getSeasonDashboard()
      .subscribe((value) => (state = value));
    http.expectOne('/api/home/content').flush(home);
    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });

    expect(state?.heroUsage.state).toBe('unavailable');
  });
});
