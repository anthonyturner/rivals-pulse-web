import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import { WinRatesPageComponent } from './win-rates-page.component';

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };

function hero(slug: string, appearances: number, wins: number): HeroStatsHero {
  return {
    hero: slug,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: 10,
    shrunkWinRate: 50,
    tier: 'B',
    kda: null,
    finalHitsAverage: null,
  };
}

const empty: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};
const partial: HeroStats = {
  ...empty,
  halfSeason: season,
  matchesCounted: 3,
  belowMinimum: [
    { hero: 'storm', appearances: 4 },
    { hero: 'thor', appearances: 2 },
  ],
};
const full: HeroStats = {
  ...partial,
  status: 'ready',
  matchesCounted: 149,
  tiers: [{ name: 'A', heroes: [hero('storm', 12, 8), hero('hela', 20, 9)] }],
};

describe('WinRatesPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'win-rates', component: WinRatesPageComponent },
          { path: 'win-rates/:season', component: WinRatesPageComponent },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  /** Opens the page, answers its two requests, and returns what it drew. */
  async function open(url: string, stats: HeroStats | 'failure'): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(url);
    http.expectOne('/api/heroes').flush([]);

    const request = http.expectOne('/api/hero-stats');

    if (stats === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(stats);
    }

    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.textContent).not.toContain('NaN');
    expect(element.textContent).not.toContain('undefined');

    return element;
  }

  const text = (element: HTMLElement, selector: string): string[] =>
    Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.trim() ?? '');

  it('says it is loading until the numbers arrive', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/win-rates');
    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading win rates');

    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush(empty);
  });

  it('lists each hero with its win rate and appearances once there is enough data', async () => {
    const element = await open('/win-rates', full);

    expect(text(element, '.season-card strong')).toEqual(['Season 10.5']);
    expect(text(element, 'tbody th strong')).toEqual(['Storm', 'Hela']);
    expect(text(element, '.rate strong')).toEqual(['66.7%', '45.0%']);
    expect(text(element, '.sample strong')).toEqual(['12', '20']);
    expect(element.querySelector('table caption')?.textContent).toContain('highest win rate first');
  });

  it('shows heroes still short of the minimum as not enough data yet, beside the full table', async () => {
    const element = await open('/win-rates', full);

    expect(text(element, '.building h2')).toEqual(['Progress toward 10 appearances']);
    expect(text(element, '.building-name')).toEqual(['Storm', 'Thor']);
    expect(text(element, '.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('keeps static panels out of the live-region announcements', async () => {
    const element = await open('/win-rates', partial);

    expect(element.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the matches counted and no table while no hero has enough data', async () => {
    const element = await open('/win-rates', partial);

    expect(text(element, '.state-panel h2')).toEqual(['Not enough data yet']);
    expect(text(element, '.state-panel p')[0]).toContain('3 matches counted');
    expect(text(element, '.state-panel p')[0]).toContain('Season 10.5');
    expect(element.querySelector('table')).toBeNull();
    expect(text(element, '.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('draws a designed empty state, not blank panels, when nothing is counted', async () => {
    const element = await open('/win-rates', empty);

    expect(text(element, '.state-panel h2')).toEqual(['Not enough data yet']);
    expect(text(element, '.state-panel p')[0]).toContain('No matches are counted');
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.building')).toBeNull();
    expect(element.querySelector('.season-card')).toBeNull();
    expect(text(element, 'h1')[0].length).toBeGreaterThan(0);
  });

  it('says the numbers could not be loaded when the request fails', async () => {
    const element = await open('/win-rates', 'failure');

    expect(text(element, '.state-panel h2')).toEqual(['Win rates could not be loaded']);
    expect(element.querySelector('table')).toBeNull();
  });

  it('answers an old season address with the empty state and a way to the current numbers', async () => {
    const element = await open('/win-rates/9', full);
    const link = element.querySelector<HTMLAnchorElement>('.action-link');

    expect(text(element, '.state-panel h2')).toEqual(['Season 9 is not shown here']);
    expect(text(element, '.state-panel p')[0]).toContain('shows only the current half-season');
    expect(element.querySelector('.season-card')).toBeNull();
    expect(element.querySelector('table')).toBeNull();
    expect(link?.textContent).toContain('See Season 10.5 win rates');
    expect(link?.getAttribute('href')).toBe('/win-rates');
  });

  it('shows the served season when the address names it', async () => {
    const element = await open('/win-rates/10.5', full);

    expect(text(element, 'tbody th strong')).toEqual(['Storm', 'Hela']);
  });

  it('labels the previous half-season when it stands in for the current one', async () => {
    const previous = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: season.startsAt };
    const element = await open('/win-rates', { ...full, halfSeason: previous, inPlaceOf: season });

    expect(text(element, '.notice')[0]).toContain('Season 10.5 does not have enough data yet');
    expect(text(element, '.season-card strong')).toEqual(['Season 10']);
  });
});
