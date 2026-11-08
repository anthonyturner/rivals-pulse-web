import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroSynergies } from '../../../contracts/hero-synergies.model';
import { synergiesOf, synergy } from './hero-synergies.fixtures';
import { HeroSynergiesService, isHeroSynergies } from './hero-synergies.service';

describe('HeroSynergiesService', () => {
  let http: HttpTestingController;
  let service: HeroSynergiesService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HeroSynergiesService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it("reads the site's own hero synergies and nothing else", () => {
    const answer = synergiesOf([synergy('hulk', 'thor', 9, 12)]);
    let result: HeroSynergies | null | undefined;

    service.getHeroSynergies().subscribe((synergies) => (result = synergies));
    http.expectOne('/api/hero-synergies').flush(answer);

    expect(result).toEqual(answer);
  });

  it('asks for one half-season and one mode, leaving out the default blend', () => {
    service.getHeroSynergies(10, 'competitive').subscribe();
    http.expectOne('/api/hero-synergies?halfSeason=10&mode=competitive').flush(synergiesOf([]));

    service.getHeroSynergies(undefined, 'all').subscribe();
    const plain = http.expectOne('/api/hero-synergies');
    expect(plain.request.params.keys()).toEqual([]);
    plain.flush(synergiesOf([]));
  });

  it('answers null when the request fails', () => {
    let result: HeroSynergies | null | undefined;

    service.getHeroSynergies().subscribe((synergies) => (result = synergies));
    http.expectOne('/api/hero-synergies').flush('down', { status: 500, statusText: 'Server Error' });

    expect(result).toBeNull();
  });

  it('answers null when the body is not hero synergies', () => {
    let result: HeroSynergies | null | undefined;

    service.getHeroSynergies().subscribe((synergies) => (result = synergies));
    http.expectOne('/api/hero-synergies').flush({ synergies: 'none' });

    expect(result).toBeNull();
  });
});

describe('isHeroSynergies', () => {
  const good = synergiesOf([synergy('hulk', 'thor', 9, 12)]);

  it('accepts a ready answer and the empty state', () => {
    expect(isHeroSynergies(good)).toBeTrue();
    expect(isHeroSynergies(synergiesOf([]))).toBeTrue();
  });

  it('accepts an answer cached before it listed half-seasons and modes, and a well-formed list', () => {
    const { halfSeasons, mode, modes, ...old } = good;

    expect([halfSeasons, mode, modes].every((part) => part !== undefined)).toBeTrue();
    expect(isHeroSynergies(old)).toBeTrue();
  });

  it('rejects half-season and mode lists the page could not read', () => {
    expect(isHeroSynergies({ ...good, halfSeasons: 'all' })).toBeFalse();
    expect(isHeroSynergies({ ...good, halfSeasons: [{ label: 'Season 10' }] })).toBeFalse();
    expect(isHeroSynergies({ ...good, modes: [{ id: 'all', label: 'All' }] })).toBeFalse();
  });

  it('rejects an answer missing a part the page reads', () => {
    expect(isHeroSynergies(null)).toBeFalse();
    expect(isHeroSynergies({ ...good, status: 'loading' })).toBeFalse();
    expect(isHeroSynergies({ ...good, minimumMatches: '10' })).toBeFalse();
    expect(isHeroSynergies({ ...good, halfSeason: undefined })).toBeFalse();
    expect(isHeroSynergies({ ...good, synergies: [{ ...good.synergies[0], winRate: Number.NaN }] })).toBeFalse();
    expect(isHeroSynergies({ ...good, synergies: [{ ...good.synergies[0], ally: 7 }] })).toBeFalse();
  });
});
