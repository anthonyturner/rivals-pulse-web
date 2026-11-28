import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { TeamLineups } from '../../../contracts/team-lineups.model';
import { lineupShape, lineupsOf, thinShape } from './team-lineups.fixtures';
import { TeamLineupsService, isTeamLineups } from './team-lineups.service';

const good = lineupsOf([lineupShape(2, 2, 2, 600, 330), thinShape(3, 2, 1)]);

describe('TeamLineupsService', () => {
  let http: HttpTestingController;
  let service: TeamLineupsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TeamLineupsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own team line-ups and nothing else", () => {
    let result: TeamLineups | null | undefined;

    service.getTeamLineups().subscribe((lineups) => (result = lineups));
    http.expectOne('/api/team-lineups').flush(good);

    expect(result).toEqual(good);
  });

  it('asks for one half-season, and leaves out Competitive, the mode the endpoint opens on', () => {
    service.getTeamLineups(10, 'competitive').subscribe();
    http.expectOne('/api/team-lineups?halfSeason=10').flush(good);
  });

  it('names every other mode, the Quick Match and Competitive blend included', () => {
    service.getTeamLineups(undefined, 'all').subscribe();
    http.expectOne('/api/team-lineups?mode=all').flush(good);

    service.getTeamLineups(10.5, 'quick-match').subscribe();
    http.expectOne('/api/team-lineups?halfSeason=10.5&mode=quick-match').flush(good);
  });

  it('answers null when the request fails', () => {
    let result: TeamLineups | null | undefined;

    service.getTeamLineups().subscribe((lineups) => (result = lineups));
    http.expectOne('/api/team-lineups').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not team line-ups', () => {
    let result: TeamLineups | null | undefined;

    service.getTeamLineups().subscribe((lineups) => (result = lineups));
    http.expectOne('/api/team-lineups').flush({ shapes: 'none' });

    expect(result).toBeNull();
  });
});

describe('isTeamLineups', () => {
  it('accepts a ready answer and the empty state', () => {
    expect(isTeamLineups(good)).toBeTrue();
    expect(isTeamLineups(lineupsOf([]))).toBeTrue();
  });

  it('accepts an answer cached before it listed half-seasons and modes', () => {
    const { halfSeasons, mode, modes, ...old } = good;

    expect([halfSeasons, mode, modes].every((part) => part !== undefined)).toBeTrue();
    expect(isTeamLineups(old)).toBeTrue();
  });

  it('rejects an answer missing a part the page reads', () => {
    const first = good.shapes[0];

    expect(isTeamLineups(null)).toBeFalse();
    expect(isTeamLineups({ ...good, status: 'loading' })).toBeFalse();
    expect(isTeamLineups({ ...good, minimumTeams: '50' })).toBeFalse();
    expect(isTeamLineups({ ...good, unclassifiedTeams: Number.NaN })).toBeFalse();
    expect(isTeamLineups({ ...good, classifiedTeams: -1 })).toBeFalse();
    expect(isTeamLineups({ ...good, halfSeason: undefined })).toBeFalse();
    expect(isTeamLineups({ ...good, modes: [{ id: 'all' }] })).toBeFalse();
    expect(isTeamLineups({ ...good, shapes: 'none' })).toBeFalse();
    expect(isTeamLineups({ ...good, shapes: [{ ...first, strategists: undefined }] })).toBeFalse();
    expect(isTeamLineups({ ...good, shapes: [{ ...first, status: 'maybe' }] })).toBeFalse();
    expect(isTeamLineups({ ...good, shapes: [{ ...first, winRate: Number.NaN }] })).toBeFalse();
    expect(isTeamLineups({ ...good, shapes: [{ ...first, teams: '600' }] })).toBeFalse();
  });
});
