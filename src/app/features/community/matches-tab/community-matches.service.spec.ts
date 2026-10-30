import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { CommunityMatchesService, isCommunityMatches } from './community-matches.service';

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const notEnoughData: CommunityMatches = {
  status: 'not-enough-data',
  minimums: { overviewMatches: 20, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [season],
  halfSeason: season,
  inPlaceOf: null,
  matchesCounted: 3,
  maps: [],
  mapsBelowMinimum: [],
  modeMix: null,
  averageLengthSeconds: null,
  perDay: null,
};
const ready: CommunityMatches = {
  ...notEnoughData,
  status: 'ready',
  matchesCounted: 40,
  maps: [{ map: 'Tokyo 2099', matches: 12, wins: 6, winRate: 50 }],
  mapsBelowMinimum: [{ map: 'Klyntar', matches: 4 }],
  modeMix: [{ playModeId: 0, mode: 'Quick Match', matches: 40, share: 100, averageLengthSeconds: 600 }],
  averageLengthSeconds: 600,
  perDay: [{ day: '2026-10-29', matches: 40 }],
};

describe('CommunityMatchesService', () => {
  let http: HttpTestingController;
  let service: CommunityMatchesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CommunityMatchesService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('reads the site own community matches and nothing else', () => {
    let result: CommunityMatches | null | undefined;

    service.getMatches().subscribe((matches) => (result = matches));
    http.expectOne('/api/community/matches').flush(ready);

    expect(result).toEqual(ready);
  });

  it('answers null when the request fails', () => {
    let result: CommunityMatches | null | undefined;

    service.getMatches().subscribe((matches) => (result = matches));
    http.expectOne('/api/community/matches').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not community matches', () => {
    let result: CommunityMatches | null | undefined;

    service.getMatches().subscribe((matches) => (result = matches));
    http.expectOne('/api/community/matches').flush({ maps: 'none' });

    expect(result).toBeNull();
  });
});

describe('isCommunityMatches', () => {
  it('accepts the not-enough-data answer and a ready one', () => {
    expect(isCommunityMatches(notEnoughData)).toBeTrue();
    expect(isCommunityMatches(ready)).toBeTrue();
    expect(isCommunityMatches({ ...notEnoughData, halfSeason: null, halfSeasons: [] })).toBeTrue();
  });

  it('rejects anything the tab could not safely read', () => {
    expect(isCommunityMatches(null)).toBeFalse();
    expect(isCommunityMatches('matches')).toBeFalse();
    expect(isCommunityMatches({ ...ready, status: 'loading' })).toBeFalse();
    expect(isCommunityMatches({ ...ready, minimums: undefined })).toBeFalse();
    expect(isCommunityMatches({ ...ready, matchesCounted: Number.NaN })).toBeFalse();
    expect(isCommunityMatches({ ...ready, maps: [null] })).toBeFalse();
    expect(isCommunityMatches({ ...ready, maps: [{ map: 'Tokyo 2099', matches: 12, wins: 6 }] })).toBeFalse();
    expect(isCommunityMatches({ ...ready, modeMix: 'none' })).toBeFalse();
    expect(isCommunityMatches({ ...ready, perDay: [{ day: 5, matches: 1 }] })).toBeFalse();
    expect(isCommunityMatches({ ...ready, halfSeason: undefined })).toBeFalse();
  });
});
