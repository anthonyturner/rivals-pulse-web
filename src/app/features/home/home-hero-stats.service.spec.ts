import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { HomeHeroStatsService } from './home-hero-stats.service';

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

describe('HomeHeroStatsService', () => {
  let http: HttpTestingController;
  let service: HomeHeroStatsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HomeHeroStatsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('asks for the hero stats once however many sections listen', () => {
    const answers: (HeroStats | null)[] = [];

    service.getHeroStats().subscribe((value) => answers.push(value));
    service.getHeroStats().subscribe((value) => answers.push(value));
    http.expectOne('/api/hero-stats').flush(stats);

    expect(answers).toEqual([stats, stats]);
  });

  it('hands a late listener the answer already received, without asking again', () => {
    service.getHeroStats().subscribe();
    http.expectOne('/api/hero-stats').flush(stats);

    let late: HeroStats | null | undefined;

    service.getHeroStats().subscribe((value) => (late = value));

    expect(late).toEqual(stats);
  });

  it('gives null, not an error, when the hero stats cannot be read', () => {
    let answer: HeroStats | null | undefined;

    service.getHeroStats().subscribe((value) => (answer = value));
    http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });

    expect(answer).toBeNull();
  });

  it('asks again on a reload and hands the new answer to everyone who listens', () => {
    const answers: (HeroStats | null)[] = [];

    service.getHeroStats().subscribe((value) => answers.push(value));
    http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });

    service.reload();
    http.expectOne('/api/hero-stats').flush(stats);

    expect(answers).toEqual([null, stats]);
  });
});
