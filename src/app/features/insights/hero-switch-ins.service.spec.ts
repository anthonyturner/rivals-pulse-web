import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroSwitchIns } from '../../../contracts/hero-switch-ins.model';
import { overallOf, switchIn, switchInsOf } from './hero-switch-in.fixtures';
import { HeroSwitchInsService, isHeroSwitchIns } from './hero-switch-ins.service';

describe('HeroSwitchInsService', () => {
  let http: HttpTestingController;
  let service: HeroSwitchInsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HeroSwitchInsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own hero switch-ins and nothing else", () => {
    const answer = switchInsOf([switchIn('hulk', 'thor', 5, 12, overallOf(26, 40))]);
    let result: HeroSwitchIns | null | undefined;

    service.getHeroSwitchIns().subscribe((switchIns) => (result = switchIns));
    http.expectOne('/api/hero-switch-ins').flush(answer);

    expect(result).toEqual(answer);
  });

  it('answers null when the request fails', () => {
    let result: HeroSwitchIns | null | undefined;

    service.getHeroSwitchIns().subscribe((switchIns) => (result = switchIns));
    http.expectOne('/api/hero-switch-ins').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not hero switch-ins', () => {
    let result: HeroSwitchIns | null | undefined;

    service.getHeroSwitchIns().subscribe((switchIns) => (result = switchIns));
    http.expectOne('/api/hero-switch-ins').flush({ switchIns: 'none' });

    expect(result).toBeNull();
  });
});

describe('isHeroSwitchIns', () => {
  it('accepts the empty state, a record with a comparison and one without', () => {
    expect(isHeroSwitchIns(switchInsOf([]))).toBeTrue();
    expect(isHeroSwitchIns(switchInsOf([switchIn('hulk', 'thor', 5, 12)]))).toBeTrue();
    expect(isHeroSwitchIns(switchInsOf([switchIn('hulk', 'thor', 5, 12, overallOf(26, 40))]))).toBeTrue();
  });

  it('rejects anything a page could not print safely', () => {
    const ready = switchInsOf([switchIn('hulk', 'thor', 5, 12)]);

    expect(isHeroSwitchIns(null)).toBeFalse();
    expect(isHeroSwitchIns([])).toBeFalse();
    expect(isHeroSwitchIns({ ...ready, status: 'maybe' })).toBeFalse();
    expect(isHeroSwitchIns({ ...ready, minimumPlayers: '2' })).toBeFalse();
    expect(isHeroSwitchIns({ ...ready, switchIns: [{ ...ready.switchIns[0], winRate: NaN }] })).toBeFalse();
    expect(isHeroSwitchIns({ ...ready, switchIns: [{ ...ready.switchIns[0], overall: { matches: 4 } }] })).toBeFalse();
    expect(isHeroSwitchIns({ ...ready, switchIns: [{ ...ready.switchIns[0], hero: 7 }] })).toBeFalse();
  });
});
