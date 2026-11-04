import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { CommunityHeroScores } from '../../../contracts/hero-scores.model';
import { HeroScoresService, isCommunityHeroScores } from './hero-scores.service';

const URL = '/api/community/hero-scores';

const launch: CommunityHeroScores = {
  status: 'not-enough-data',
  minimums: { matches: 10, contributors: 3, busiestContributorShare: 0.5, rankedHeroes: 5 },
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  heroes: [],
};

describe('HeroScoresService', () => {
  let http: HttpTestingController;
  let service: HeroScoresService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(HeroScoresService);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('reads the scores once and shares the answer', () => {
    const answers: unknown[] = [];

    service.getHeroScores().subscribe((scores) => answers.push(scores));
    service.getHeroScores().subscribe((scores) => answers.push(scores));
    http.expectOne(URL).flush(launch);
    service.getHeroScores().subscribe((scores) => answers.push(scores));

    expect(answers).toEqual([launch, launch, launch]);
  });

  it('answers null when the request fails, and tries again next time', () => {
    let result: unknown = 'unset';

    service.getHeroScores().subscribe((scores) => (result = scores));
    http.expectOne(URL).flush('nope', { status: 500, statusText: 'Server Error' });
    expect(result).toBeNull();

    service.getHeroScores().subscribe((scores) => (result = scores));
    http.expectOne(URL).flush(launch);
    expect(result).toEqual(launch);
  });

  it('answers null for a body that is not scores', () => {
    let result: unknown = 'unset';

    service.getHeroScores().subscribe((scores) => (result = scores));
    http.expectOne(URL).flush({ status: 'ready' });

    expect(result).toBeNull();
  });

  it('recognises the designed not-enough-data answer as scores', () => {
    expect(isCommunityHeroScores(launch)).toBeTrue();
    expect(isCommunityHeroScores(null)).toBeFalse();
    expect(isCommunityHeroScores({ ...launch, heroes: 'none' })).toBeFalse();
    expect(isCommunityHeroScores({ ...launch, minimums: null })).toBeFalse();
  });
});
