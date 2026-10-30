import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroStats } from '../../../contracts/hero-stats.model';
import { HeroStatsService, isHeroStats } from './hero-stats.service';

const notEnoughData: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};

describe('HeroStatsService', () => {
  let http: HttpTestingController;
  let service: HeroStatsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HeroStatsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own hero stats and nothing else", () => {
    let result: HeroStats | null | undefined;

    service.getHeroStats().subscribe((stats) => (result = stats));
    http.expectOne('/api/hero-stats').flush(notEnoughData);

    expect(result).toEqual(notEnoughData);
  });

  it('asks for exactly one half-season when given one', () => {
    let result: HeroStats | null | undefined;

    service.getHeroStats(10.5).subscribe((stats) => (result = stats));
    http.expectOne('/api/hero-stats?halfSeason=10.5').flush(notEnoughData);

    expect(result).toEqual(notEnoughData);
  });

  it('answers null when the request fails', () => {
    let result: HeroStats | null | undefined;

    service.getHeroStats().subscribe((stats) => (result = stats));
    http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not hero stats', () => {
    let result: HeroStats | null | undefined;

    service.getHeroStats().subscribe((stats) => (result = stats));
    http.expectOne('/api/hero-stats').flush({ tiers: 'none' });

    expect(result).toBeNull();
  });
});

describe('isHeroStats', () => {
  it('accepts the not-enough-data answer and a ready one', () => {
    expect(isHeroStats(notEnoughData)).toBeTrue();
    expect(
      isHeroStats({ ...notEnoughData, status: 'ready', tiers: [{ name: 'A', heroes: [] }] }),
    ).toBeTrue();
  });

  it('rejects anything the pages could not safely read', () => {
    expect(isHeroStats(null)).toBeFalse();
    expect(isHeroStats('stats')).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, status: 'loading' })).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, matchesCounted: Number.NaN })).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, tiers: [null] })).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, belowMinimum: undefined })).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, halfSeasons: undefined })).toBeFalse();
  });
});
