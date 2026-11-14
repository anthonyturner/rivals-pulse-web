import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HeroDataService } from './hero-data.service';
import type { Hero } from './hero.model';

const ROSTER = [{ id: 'storm', name: 'Storm' }] as Hero[];

describe('HeroDataService', () => {
  let service: HeroDataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(HeroDataService);
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('asks for the roster once and shares the answer with every caller, before and after it arrives', () => {
    const first: (Hero[] | null)[] = [];
    const second: Hero[][] = [];
    const late: (Hero[] | null)[] = [];

    service.getHeroRoster().subscribe((heroes) => first.push(heroes));
    service.getHeroes().subscribe((heroes) => second.push(heroes));
    http.expectOne('/api/heroes').flush(ROSTER);
    service.getHeroRoster().subscribe((heroes) => late.push(heroes));

    expect(first).toEqual([ROSTER]);
    expect(second).toEqual([ROSTER]);
    expect(late).toEqual([ROSTER]);
  });

  it('answers null for a roster that failed, and an empty list to the callers that cannot tell', () => {
    const roster: (Hero[] | null)[] = [];
    const heroes: Hero[][] = [];

    service.getHeroRoster().subscribe((value) => roster.push(value));
    service.getHeroes().subscribe((value) => heroes.push(value));
    http.expectOne('/api/heroes').flush('down', { status: 500, statusText: 'Server Error' });

    expect(roster).toEqual([null]);
    expect(heroes).toEqual([[]]);
  });

  it('does not keep a failed load: the next caller asks again, and a good answer is then kept', () => {
    service.getHeroRoster().subscribe();
    http.expectOne('/api/heroes').flush('down', { status: 500, statusText: 'Server Error' });

    const retry: (Hero[] | null)[] = [];
    service.getHeroRoster().subscribe((heroes) => retry.push(heroes));
    http.expectOne('/api/heroes').flush(ROSTER);
    service.getHeroRoster().subscribe();

    expect(retry).toEqual([ROSTER]);
  });

  it('treats an empty roster as missing and asks again next time', () => {
    const roster: (Hero[] | null)[] = [];

    service.getHeroRoster().subscribe((value) => roster.push(value));
    http.expectOne('/api/heroes').flush([]);
    service.getHeroRoster().subscribe();
    http.expectOne('/api/heroes').flush(ROSTER);

    expect(roster).toEqual([null]);
  });
});
