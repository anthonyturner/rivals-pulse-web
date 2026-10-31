import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { HomeHeroStatsService } from './home-hero-stats.service';
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

  it('asks for the hero stats once for the glance and every other section together', () => {
    let shared: HeroStats | null | undefined;
    let glance: SeasonGlanceState | undefined;

    TestBed.inject(HomeHeroStatsService)
      .getHeroStats()
      .subscribe((value) => (shared = value));
    TestBed.inject(SeasonGlanceService)
      .getSeasonGlance()
      .subscribe((value) => (glance = value));

    http.expectOne('/api/home/content').flush(home);
    http.expectOne('/api/hero-stats').flush(stats);

    expect(shared).toEqual(stats);
    expect(glance?.seasonDateRange).not.toBe('');
  });

  it('asks again on a reload and hands the new answer to everyone who listens', () => {
    const answers: (HeroStats | null)[] = [];

    TestBed.inject(HomeHeroStatsService)
      .getHeroStats()
      .subscribe((value) => answers.push(value));
    http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });

    TestBed.inject(HomeHeroStatsService).reload();
    http.expectOne('/api/hero-stats').flush(stats);

    expect(answers).toEqual([null, stats]);
  });
});
