import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { HeroMatchups } from '../../../contracts/hero-matchups.model';
import { CurrentHeroMatchupsService } from './current-hero-matchups.service';
import { matchup, matchupsOf } from './hero-matchup.fixtures';

describe('CurrentHeroMatchupsService', () => {
  let http: HttpTestingController;
  let service: CurrentHeroMatchupsService;
  const answer = matchupsOf([matchup('hulk', 'thor', 9, 12)]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(CurrentHeroMatchupsService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('asks for the matchups once however many pages listen', () => {
    const answers: (HeroMatchups | null)[] = [];

    service.getHeroMatchups().subscribe((value) => answers.push(value));
    service.getHeroMatchups().subscribe((value) => answers.push(value));
    http.expectOne('/api/hero-matchups').flush(answer);

    expect(answers).toEqual([answer, answer]);
  });

  it('hands a late listener the answer already received, without asking again', () => {
    service.getHeroMatchups().subscribe();
    http.expectOne('/api/hero-matchups').flush(answer);

    let late: HeroMatchups | null | undefined;

    service.getHeroMatchups().subscribe((value) => (late = value));

    expect(late).toEqual(answer);
  });

  it('asks again after a failed read, so a failure is not kept', () => {
    let first: HeroMatchups | null | undefined;

    service.getHeroMatchups().subscribe((value) => (first = value));
    http.expectOne('/api/hero-matchups').flush('down', { status: 500, statusText: 'Server Error' });

    expect(first).toBeNull();

    let retry: HeroMatchups | null | undefined;

    service.getHeroMatchups().subscribe((value) => (retry = value));
    http.expectOne('/api/hero-matchups').flush(answer);

    expect(retry).toEqual(answer);
  });
});
