import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { RoleStats } from '../../../../contracts/role-stats.model';
import { RoleStatsService, isRoleStats } from './role-stats.service';

const notEnoughData: RoleStats = {
  status: 'not-enough-data',
  minimumLines: 50,
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  modes: [
    {
      id: 'all',
      label: 'Quick Match and Competitive',
      roles: [
        {
          role: 'Vanguard',
          appearances: 0,
          status: 'not-enough-data',
          winRate: null,
          killsAverage: null,
          deathsAverage: null,
          assistsAverage: null,
          kda: null,
          finalHitsAverage: null,
        },
      ],
    },
  ],
};

describe('RoleStatsService', () => {
  let http: HttpTestingController;
  let service: RoleStatsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(RoleStatsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own role stats and nothing else", () => {
    let result: RoleStats | null | undefined;

    service.getRoleStats().subscribe((stats) => (result = stats));
    http.expectOne('/api/community/stats').flush(notEnoughData);

    expect(result).toEqual(notEnoughData);
  });

  it('answers null when the request fails', () => {
    let result: RoleStats | null | undefined;

    service.getRoleStats().subscribe((stats) => (result = stats));
    http.expectOne('/api/community/stats').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the answer is not role stats', () => {
    let result: RoleStats | null | undefined;

    service.getRoleStats().subscribe((stats) => (result = stats));
    http.expectOne('/api/community/stats').flush({ message: 'hello' });

    expect(result).toBeNull();
  });
});

describe('isRoleStats', () => {
  it('accepts a well-formed answer', () => {
    expect(isRoleStats(notEnoughData)).toBeTrue();
  });

  it('rejects anything the tab could not read safely', () => {
    expect(isRoleStats(null)).toBeFalse();
    expect(isRoleStats([])).toBeFalse();
    expect(isRoleStats({ ...notEnoughData, status: 'weird' })).toBeFalse();
    expect(isRoleStats({ ...notEnoughData, modes: 'x' })).toBeFalse();
    expect(isRoleStats({ ...notEnoughData, modes: [{ id: 'all', label: 'x', roles: [{ role: 'Vanguard' }] }] })).toBeFalse();
    expect(isRoleStats({ ...notEnoughData, minimumLines: Number.NaN })).toBeFalse();
  });
});
