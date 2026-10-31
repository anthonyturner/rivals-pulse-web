import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { CommunityFigures } from '../../../contracts/community-figures.model';
import type { CommunityKills } from '../../../contracts/community-kills.model';
import { CommunityFiguresService, isCommunityFigures } from './community-figures.service';
import { CommunityKillsService, isCommunityKills } from './community-kills.service';
import { figuresOf, heroFigures, killPair, killsOf, perMinuteOf } from './community-extended.fixtures';

describe('the community extended services', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  describe('CommunityFiguresService', () => {
    const answer = figuresOf({ Duelist: { damage: 612 } }, [heroFigures('hela', { damage: 640 })]);

    it("reads the site's own community figures and nothing else", () => {
      let result: CommunityFigures | null | undefined;

      TestBed.inject(CommunityFiguresService)
        .getFigures()
        .subscribe((figures) => (result = figures));
      http.expectOne('/api/community/figures').flush(answer);

      expect(result).toEqual(answer);
    });

    it('answers null when the request fails or the body is not community figures', () => {
      const results: (CommunityFigures | null)[] = [];
      const service = TestBed.inject(CommunityFiguresService);

      service.getFigures().subscribe((figures) => results.push(figures));
      http.expectOne('/api/community/figures').flush('down', { status: 500, statusText: 'Server Error' });
      service.getFigures().subscribe((figures) => results.push(figures));
      http.expectOne('/api/community/figures').flush({ modes: 'none' });

      expect(results).toEqual([null, null]);
    });

    it('checks the parts the pages read', () => {
      expect(isCommunityFigures(answer)).toBeTrue();
      expect(isCommunityFigures({ ...answer, status: 'maybe' })).toBeFalse();
      expect(isCommunityFigures({ ...answer, minimums: null })).toBeFalse();
      expect(isCommunityFigures({ ...answer, modes: [{ ...answer.modes[0], roles: [{ role: 'Duelist', damage: 'lots' }] }] })).toBeFalse();
      expect(isCommunityFigures({ ...answer, modes: [{ ...answer.modes[0], heroes: [{ damage: 1, healing: null, blocked: null }] }] })).toBeFalse();
      expect(isCommunityFigures(null)).toBeFalse();
      expect(isCommunityFigures(perMinuteOf())).toBeFalse();
    });
  });

  describe('CommunityKillsService', () => {
    const answer = killsOf([killPair('hela', 'hulk', 100)]);

    it("reads the site's own community kills and nothing else", () => {
      let result: CommunityKills | null | undefined;

      TestBed.inject(CommunityKillsService)
        .getKills()
        .subscribe((kills) => (result = kills));
      http.expectOne('/api/community/kills').flush(answer);

      expect(result).toEqual(answer);
    });

    it('answers null when the request fails or the body is not community kills', () => {
      const results: (CommunityKills | null)[] = [];
      const service = TestBed.inject(CommunityKillsService);

      service.getKills().subscribe((kills) => results.push(kills));
      http.expectOne('/api/community/kills').flush('down', { status: 500, statusText: 'Server Error' });
      service.getKills().subscribe((kills) => results.push(kills));
      http.expectOne('/api/community/kills').flush({ pairs: 'none' });

      expect(results).toEqual([null, null]);
    });

    it('checks the parts the pages read', () => {
      expect(isCommunityKills(answer)).toBeTrue();
      expect(isCommunityKills({ ...answer, status: 'maybe' })).toBeFalse();
      expect(isCommunityKills({ ...answer, pairs: [{ killer: 'hela', victim: 'hulk' }] })).toBeFalse();
      expect(isCommunityKills({ ...answer, pairs: [{ killer: 'hela', victim: 7, killsBand: 25 }] })).toBeFalse();
      expect(isCommunityKills(undefined)).toBeFalse();
    });
  });
});
