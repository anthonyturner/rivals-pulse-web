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
  minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [SEASON],
  halfSeason: SEASON,
  inPlaceOf: null,
  matchesCounted: null,
  maps: [],
  mapsBelowMinimum: [],
  modeMix: null,
  averageLengthMinutes: null,
  perDay: null,
};
const READY: CommunityMatches = {
  ...EMPTY,
  status: 'ready',
  matchesCounted: 20,
  maps: [{ map: 'Tokyo 2099', winRate: 50 }],
  mapsBelowMinimum: ['Klyntar'],
  modeMix: [{ playModeId: 0, mode: 'Quick Match', share: 100, averageLengthMinutes: 10 }],
  averageLengthMinutes: 10,
  perDay: [{ day: '2026-10-29', share: 100 }],
};

describe('MatchesTabComponent', () => {
  let fixture: ComponentFixture<MatchesTabComponent>;
  let http: HttpTestingController;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const headings = (): string[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('h2, h3')).map((heading) => heading.textContent?.trim() ?? '');

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

    expect(text()).toContain('Season 10.5 does not have enough data yet');
    expect(text()).toContain('Totals appear once enough matches have been uploaded');
    expect(text()).not.toMatch(/NaN|undefined|null|0/);
    expect(headings()).toEqual(['Community matches']);
  });

  it('shows the four sections with the figures', async () => {
    await answer(READY);

    expect(headings()).toEqual(['Community matches', 'Win rate by map', 'Game modes played', 'Matches per day']);
    expect(text()).toContain('Tokyo 2099');
    expect(text()).toContain('50%');
    expect(text()).not.toContain('Klyntar');
    expect(text()).toContain('20 matches in Season 10.5');
    expect(text()).toContain('Quick Match');
    expect(text()).toContain('10 min');
    expect(text()).toContain('Thu 29 Oct');
    expect(text()).not.toMatch(/NaN|undefined|null/);
  });

  it('links the map teaser to the Maps tab, which lists every map', async () => {
    await answer(READY);

    const link = (fixture.nativeElement as HTMLElement).querySelector('a.stat-link') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('See the Maps tab');
    expect(link.getAttribute('href')).toBe('/stats/maps');
  });

  it('labels a previous half-season that stands in for the current one', async () => {
    await answer({
      ...READY,
      halfSeason: { ...SEASON, id: 10, label: 'Season 10' },
      inPlaceOf: SEASON,
    });

    expect((fixture.nativeElement as HTMLElement).querySelector('.tab-scope')?.textContent?.trim()).toBe('Season 10');
    expect(text()).toContain("Season 10.5 does not have enough data yet, so these are Season 10's numbers");
  });

  it('gives each section a note instead of a blank panel when it has no figures', async () => {
    await answer({ ...READY, modeMix: null, averageLengthMinutes: null, perDay: null, maps: [], mapsBelowMinimum: [] });

    expect(text()).toContain('A map needs 10 matches in one game mode and 10 with a result');
    expect(text()).toContain('The mix appears at 10 matches');
    expect(text()).toContain('An average needs 10 matches with a known length');
    expect(text()).toContain('A day is listed once it has 10 matches');
  });

  it('says the totals cannot be loaded when the request fails', async () => {
    await answer(null, 500);

    expect(text()).toContain("The community's matches could not be loaded");
  });

  it('shows no player, only totals', async () => {
    await answer(READY);

    expect(text().toLowerCase()).not.toMatch(/uid|nickname|player name/);
  });
});
