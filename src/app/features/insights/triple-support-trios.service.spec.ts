import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { TripleSupportTrios } from '../../../contracts/triple-support-trios.model';
import { trio, triosOf } from './triple-support-trios.fixtures';
import { TripleSupportTriosService, isTripleSupportTrios } from './triple-support-trios.service';

const good = triosOf([trio(['loki', 'luna-snow', 'mantis'], 'Mantis triple', 20, 10)]);

describe('TripleSupportTriosService', () => {
  let http: HttpTestingController;
  let service: TripleSupportTriosService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TripleSupportTriosService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own triple-support trios and nothing else", () => {
    let result: TripleSupportTrios | null | undefined;

    service.getTripleSupportTrios().subscribe((trios) => (result = trios));
    http.expectOne('/api/triple-support-trios').flush(good);

    expect(result).toEqual(good);
  });

  it('asks for one half-season and one mode, leaving out the default blend', () => {
    service.getTripleSupportTrios(10, 'competitive').subscribe();
    http.expectOne('/api/triple-support-trios?halfSeason=10&mode=competitive').flush(good);

    service.getTripleSupportTrios(undefined, 'all').subscribe();
    const plain = http.expectOne('/api/triple-support-trios');
    expect(plain.request.params.keys()).toEqual([]);
    plain.flush(good);
  });

  it('answers null when the request fails', () => {
    let result: TripleSupportTrios | null | undefined;

    service.getTripleSupportTrios().subscribe((trios) => (result = trios));
    http.expectOne('/api/triple-support-trios').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not triple-support trios', () => {
    let result: TripleSupportTrios | null | undefined;

    service.getTripleSupportTrios().subscribe((trios) => (result = trios));
    http.expectOne('/api/triple-support-trios').flush({ trios: 'none' });

    expect(result).toBeNull();
  });
});

describe('isTripleSupportTrios', () => {
  it('accepts a ready answer and the empty state', () => {
    expect(isTripleSupportTrios(good)).toBeTrue();
    expect(isTripleSupportTrios(triosOf([]))).toBeTrue();
  });

  it('accepts an answer cached before it listed half-seasons and modes', () => {
    const { halfSeasons, mode, modes, ...old } = good;

    expect([halfSeasons, mode, modes].every((part) => part !== undefined)).toBeTrue();
    expect(isTripleSupportTrios(old)).toBeTrue();
  });

  it('rejects an answer missing a part the page reads', () => {
    const first = good.trios[0];

    expect(isTripleSupportTrios(null)).toBeFalse();
    expect(isTripleSupportTrios({ ...good, status: 'loading' })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, minimumMatches: '10' })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, fourPlusTeams: Number.NaN })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, halfSeason: undefined })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, modes: [{ id: 'all' }] })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, trios: [{ ...first, heroes: undefined }] })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, trios: [{ ...first, variant: null }] })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, trios: [{ ...first, share: Number.NaN }] })).toBeFalse();
    expect(isTripleSupportTrios({ ...good, trios: [{ ...first, heroes: ['loki', 'mantis'] }] })).toBeFalse();
  });
});
