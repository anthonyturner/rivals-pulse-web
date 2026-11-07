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

  it('asks for one mode on its own, with or without a half-season', () => {
    service.getHeroStats(undefined, 'competitive').subscribe();
    const byMode = http.expectOne('/api/hero-stats?mode=competitive');
    expect(byMode.request.params.get('mode')).toBe('competitive');
    byMode.flush(notEnoughData);

    service.getHeroStats(10, 'arcade').subscribe();
    const both = http.expectOne('/api/hero-stats?halfSeason=10&mode=arcade');
    expect(both.request.params.keys().sort()).toEqual(['halfSeason', 'mode']);
    both.flush(notEnoughData);
  });

  it('asks for the default blend with no mode, so it shares the default answer', () => {
    service.getHeroStats(undefined, 'all').subscribe();
    const plain = http.expectOne('/api/hero-stats');
    expect(plain.request.params.keys()).toEqual([]);
    plain.flush(notEnoughData);

    service.getHeroStats(10, 'all').subscribe();
    const season = http.expectOne('/api/hero-stats?halfSeason=10');
    expect(season.request.params.has('mode')).toBeFalse();
    season.flush(notEnoughData);
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

  it('accepts an answer with no mode list, and one with a well-formed list', () => {
    const modes = [{ id: 'all', label: 'Quick Match and Competitive', decidedMatches: 173 }];

    expect(isHeroStats({ ...notEnoughData, mode: 'all', modes })).toBeTrue();
    expect(isHeroStats({ ...notEnoughData, mode: null, modes: [] })).toBeTrue();
  });

  it('rejects a mode list the pages could not safely read', () => {
    expect(isHeroStats({ ...notEnoughData, modes: 'all' })).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, modes: [null] })).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, modes: [{ id: 'all', label: 'All' }] })).toBeFalse();
    expect(isHeroStats({ ...notEnoughData, modes: [{ id: 'all', label: 'All', decidedMatches: Number.NaN }] })).toBeFalse();
  });
});
