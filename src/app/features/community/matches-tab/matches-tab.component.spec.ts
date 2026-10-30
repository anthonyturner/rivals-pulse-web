import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { MatchesTabComponent } from './matches-tab.component';

const SEASON = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const EMPTY: CommunityMatches = {
  status: 'not-enough-data',
  minimums: { overviewMatches: 20, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [SEASON],
  halfSeason: SEASON,
  inPlaceOf: null,
  matchesCounted: 3,
  maps: [],
  mapsBelowMinimum: [],
  modeMix: null,
  averageLengthSeconds: null,
  perDay: null,
};
const READY: CommunityMatches = {
  ...EMPTY,
  status: 'ready',
  matchesCounted: 40,
  maps: [{ map: 'Tokyo 2099', matches: 12, wins: 6, winRate: 50 }],
  mapsBelowMinimum: [{ map: 'Klyntar', matches: 4 }],
  modeMix: [{ playModeId: 0, mode: 'Quick Match', matches: 40, share: 100, averageLengthSeconds: 600 }],
  averageLengthSeconds: 600,
  perDay: [{ day: '2026-10-29', matches: 40 }],
};

describe('MatchesTabComponent', () => {
  let fixture: ComponentFixture<MatchesTabComponent>;
  let http: HttpTestingController;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const headings = (): string[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2')).map((heading) => heading.textContent?.trim() ?? '');

  async function answer(body: CommunityMatches | null, status = 200): Promise<void> {
    const request = http.expectOne('/api/community/matches');

    if (status === 200) {
      request.flush(body);
    } else {
      request.flush('down', { status, statusText: 'Server Error' });
    }

    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MatchesTabComponent);
    fixture.detectChanges();
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('says it is loading until the totals arrive', () => {
    expect(text()).toContain("Loading the community's matches");
    http.expectOne('/api/community/matches').flush(EMPTY);
  });

  it('shows the designed not-enough-data state, with the sample so far', async () => {
    await answer(EMPTY);

    expect(text()).toContain('Not enough data yet');
    expect(text()).toContain('Season 10.5 has 3 matches counted so far');
    expect(headings()).toEqual(['Community matches']);
  });

  it('shows the four sections with the figures, and what the thin maps still need', async () => {
    await answer(READY);

    expect(headings()).toEqual(['Win rate by map', 'Game modes played', 'Average match length', 'Matches per day']);
    expect(text()).toContain('Tokyo 2099');
    expect(text()).toContain('50.0%');
    expect(text()).toContain('6 wins in 12 matches');
    expect(text()).toContain('Klyntar: 4 of 10 matches');
    expect(text()).toContain('Quick Match');
    expect(text()).toContain('10 min');
    expect(text()).toContain('Thu 29 Oct');
    expect(text()).not.toMatch(/NaN|undefined|null/);
  });

  it('labels a previous half-season that stands in for the current one', async () => {
    await answer({
      ...READY,
      halfSeason: { ...SEASON, id: 10, label: 'Season 10' },
      inPlaceOf: SEASON,
    });

    expect(text()).toContain('Showing Season 10');
    expect(text()).toContain("Season 10.5 does not have enough data yet, so these are Season 10's numbers");
  });

  it('gives each section a note instead of a blank panel when it has no figures', async () => {
    await answer({ ...READY, modeMix: null, averageLengthSeconds: null, perDay: null, maps: [], mapsBelowMinimum: [] });

    expect(text()).toContain('A map needs 10 matches with a result');
    expect(text()).toContain('The mix appears at 20 matches');
    expect(text()).toContain('An average needs 10 matches with a known length');
    expect(text()).toContain('Days appear at 20 matches');
  });

  it('says the totals cannot be loaded when the request fails', async () => {
    await answer(null, 500);

    expect(text()).toContain('cannot be loaded right now');
  });

  it('shows no player, only totals', async () => {
    await answer(READY);

    expect(text().toLowerCase()).not.toMatch(/uid|nickname|player name/);
  });
});
