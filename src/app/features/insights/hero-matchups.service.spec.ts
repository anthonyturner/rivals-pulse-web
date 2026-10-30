import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroMatchups } from '../../../contracts/hero-matchups.model';
import { matchup, matchupsOf } from './hero-matchup.fixtures';
import { HeroMatchupsService, isHeroMatchups } from './hero-matchups.service';

describe('HeroMatchupsService', () => {
  let http: HttpTestingController;
  let service: HeroMatchupsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HeroMatchupsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own hero matchups and nothing else", () => {
    const answer = matchupsOf([matchup('hulk', 'thor', 9, 12)]);
    let result: HeroMatchups | null | undefined;

    service.getHeroMatchups().subscribe((matchups) => (result = matchups));
    http.expectOne('/api/hero-matchups').flush(answer);

    expect(result).toEqual(answer);
  });

  it('answers null when the request fails', () => {
    let result: HeroMatchups | null | undefined;

    service.getHeroMatchups().subscribe((matchups) => (result = matchups));
    http.expectOne('/api/hero-matchups').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not hero matchups', () => {
    let result: HeroMatchups | null | undefined;

    service.getHeroMatchups().subscribe((matchups) => (result = matchups));
    http.expectOne('/api/hero-matchups').flush({ matchups: 'none' });

    expect(result).toBeNull();
  });
});

describe('isHeroMatchups', () => {
  it('accepts the empty state and a list of readable records', () => {
    expect(isHeroMatchups(matchupsOf([]))).toBeTrue();
    expect(isHeroMatchups(matchupsOf([matchup('hulk', 'thor', 9, 12)]))).toBeTrue();
  });

  it('rejects anything a page could not print safely', () => {
    expect(isHeroMatchups(null)).toBeFalse();
    expect(isHeroMatchups('matchups')).toBeFalse();
    expect(isHeroMatchups({ ...matchupsOf([]), status: 'loading' })).toBeFalse();
    expect(isHeroMatchups({ ...matchupsOf([]), matchups: undefined })).toBeFalse();
    expect(isHeroMatchups({ ...matchupsOf([]), matchups: [null] })).toBeFalse();
    expect(isHeroMatchups(matchupsOf([{ ...matchup('hulk', 'thor', 9, 12), winRate: Number.NaN }]))).toBeFalse();
    expect(isHeroMatchups(matchupsOf([{ ...matchup('hulk', 'thor', 9, 12), enemy: 3 as unknown as string }]))).toBeFalse();
  });
});
