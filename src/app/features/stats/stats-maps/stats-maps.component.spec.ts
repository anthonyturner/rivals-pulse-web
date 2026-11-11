import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { ThinContent } from '../../../core/seo/thin-content';
import { StatsMapsComponent } from './stats-maps.component';

const SEASON = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const PREVIOUS = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: '2026-10-09T09:00:00Z' };
const MAPS = [
  { map: 'Yggdrasill Path', winRate: 69 },
  { map: "Birnin T'Challa", winRate: 67 },
  { map: 'Hall of Djalia', winRate: 64 },
  { map: 'Central Park', winRate: 50 },
  { map: 'Lower Manhattan', winRate: 42 },
  { map: 'Midtown', winRate: 41 },
  { map: 'Spider-Islands', winRate: 41 },
];
const READY: CommunityMatches = {
  status: 'ready',
  minimums: { overviewMatches: 10, mapMatches: 10, lengthMatches: 10 },
  halfSeasons: [PREVIOUS, SEASON],
  halfSeason: SEASON,
  inPlaceOf: null,
  matchesCounted: 502,
  maps: MAPS,
  mapsBelowMinimum: ['Arakko', 'Krakoa'],
  modeMix: null,
  averageLengthMinutes: null,
  perDay: null,
};

describe('StatsMapsComponent', () => {
  let fixture: ComponentFixture<StatsMapsComponent>;
  let http: HttpTestingController;

  const element = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => element().textContent ?? '';
  const rowNames = (panel: string): (string | undefined)[] =>
    Array.from(element().querySelectorAll(`${panel} tbody th[scope="row"]`)).map((row) => row.textContent?.trim());

  async function answer(body: unknown, status = 200): Promise<void> {
    http.expectOne('/api/community/matches').flush(body as object | null, { status, statusText: status === 200 ? 'OK' : 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(StatsMapsComponent);
    fixture.detectChanges();
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  it('says it is loading, and counts as thin, until the answer arrives', () => {
    expect(text()).toContain("Loading the community's map stats");
    expect(TestBed.inject(ThinContent).thin()).toBeTrue();
    http.expectOne('/api/community/matches').flush(READY);
  });

  it('lists the best three, the worst three and every map best first, with a whole-percentage win rate', async () => {
    await answer(READY);

    expect(rowNames('[aria-labelledby="maps-best-title"]')).toEqual(['Yggdrasill Path', "Birnin T'Challa", 'Hall of Djalia']);
    expect(rowNames('[aria-labelledby="maps-worst-title"]')).toEqual(['Spider-Islands', 'Midtown', 'Lower Manhattan']);
    expect(rowNames('[aria-labelledby="maps-all-title"]')).toEqual(MAPS.map((record) => record.map));
    expect(text()).toContain('69%');
    expect(text()).not.toMatch(/NaN|undefined|null/);
  });

  it('is a page with content, with an ad slot and an index entry, once a map has a rate', async () => {
    await answer(READY);

    expect(TestBed.inject(ThinContent).thin()).toBeFalse();
  });

  it('names the maps without a rate yet under "Not enough matches yet", with no count', async () => {
    await answer(READY);

    const panel = element().querySelector('[aria-labelledby="maps-waiting-title"]') as HTMLElement;

    expect(panel.querySelector('h3')?.textContent?.trim()).toBe('Not enough matches yet');
    expect(panel.textContent).toContain('Arakko, Krakoa.');
    expect(panel.textContent?.replace('Not enough matches yet', '')).not.toMatch(/\d/);
  });

  it('leaves out the waiting panel when every known map has a rate', async () => {
    await answer({ ...READY, mapsBelowMinimum: [] });

    expect(element().querySelector('[aria-labelledby="maps-waiting-title"]')).toBeNull();
  });

  it('shows one map as the best and no worst panel', async () => {
    await answer({ ...READY, maps: [MAPS[0]] });

    expect(rowNames('[aria-labelledby="maps-best-title"]')).toEqual(['Yggdrasill Path']);
    expect(element().querySelector('[aria-labelledby="maps-worst-title"]')).toBeNull();
    expect(TestBed.inject(ThinContent).thin()).toBeFalse();
  });

  it('labels a previous half-season that stands in for the current one', async () => {
    await answer({ ...READY, halfSeason: PREVIOUS, inPlaceOf: SEASON });

    expect(element().querySelector('.tab-scope')?.textContent?.trim()).toBe('Season 10');
    expect(text()).toContain("Season 10.5 does not have enough data yet, so these are Season 10's numbers");
  });

  it('stays thin, and says what a map needs, until one map has a rate', async () => {
    await answer({ ...READY, maps: [], mapsBelowMinimum: ['Arakko'] });

    expect(text()).toContain('Season 10.5 has no map with a win rate yet.');
    expect(text()).toContain('A map needs 10 matches in one game mode and 10 with a result');
    expect(element().querySelector('table')).toBeNull();
    expect(TestBed.inject(ThinContent).thin()).toBeTrue();
  });

  it('says the stats cannot be loaded, and stays thin, when the request fails', async () => {
    await answer(null, 500);

    expect(text()).toContain("The community's map stats could not be loaded");
    expect(TestBed.inject(ThinContent).thin()).toBeTrue();
  });

  it('shows no exact count of matches, only whole percentages', async () => {
    await answer(READY);

    const values = Array.from(element().querySelectorAll('.stat-meter__value')).map((value) => value.textContent?.trim() ?? '');

    expect(values.every((value) => /^\d{1,3}%$/.test(value))).toBeTrue();
    expect(text()).not.toContain('502');
  });
});
