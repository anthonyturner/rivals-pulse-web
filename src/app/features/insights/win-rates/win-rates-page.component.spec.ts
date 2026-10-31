import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { HeroStats, HeroStatsHero, HeroStatsMode } from '../../../../contracts/hero-stats.model';
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

const MODES: HeroStatsMode[] = [
  { id: 'all', label: 'Quick Match and Competitive', decidedMatches: 173 },
  { id: 'quick-match', label: 'Quick Match', decidedMatches: 145 },
  { id: 'competitive', label: 'Competitive', decidedMatches: 28 },
  { id: 'arcade', label: 'Arcade', decidedMatches: 0 },
  { id: 'practice', label: 'Practice', decidedMatches: 1 },
];

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

    expect(text(element, '.state-panel h2')).toEqual([
      'Not enough data yet in Quick Match and Competitive for Season 10.5',
    ]);
    expect(text(element, '.state-panel p')[0].replace(/\s+/g, ' ')).toContain(
      '3 matches counted in Quick Match and Competitive for Season 10.5 so far',
    );
    expect(element.querySelector('table')).toBeNull();
    expect(text(element, '.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('draws a designed empty state, not blank panels, when nothing is counted', async () => {
    const element = await open('/win-rates', empty);

    expect(text(element, '.state-panel h2')).toEqual(['Not enough data yet in Quick Match and Competitive']);
    expect(text(element, '.state-panel p')[0].replace(/\s+/g, ' ')).toContain(
      'No matches are counted in Quick Match and Competitive yet',
    );
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

  describe('the mode picker', () => {
    const withModes: HeroStats = { ...full, mode: 'all', modes: MODES };
    const modeSelect = (element: HTMLElement): HTMLSelectElement =>
      element.querySelector('app-filter-select select') as HTMLSelectElement;

    function choose(select: HTMLSelectElement, value: string): void {
      select.value = value;
      select.dispatchEvent(new Event('change'));
    }

    async function openWithPicker(): Promise<{ harness: RouterTestingHarness; element: HTMLElement }> {
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl('/win-rates');
      http.expectOne('/api/heroes').flush([]);
      http.expectOne('/api/hero-stats').flush(withModes);
      harness.detectChanges();

      return { harness, element: harness.routeNativeElement as HTMLElement };
    }

    it('lists only the modes that hold a decided match, the default first, and never Practice', async () => {
      const { element } = await openWithPicker();

      expect(text(element, '.filter-select__label')).toEqual(['Mode']);
      expect(Array.from(modeSelect(element).options).map((option) => option.textContent?.trim())).toEqual([
        'Quick Match and Competitive',
        'Quick Match',
        'Competitive',
      ]);
      expect(modeSelect(element).value).toBe('all');
    });

    it('draws no picker when only the default blend holds matches', async () => {
      const element = await open('/win-rates', { ...withModes, modes: [MODES[0]] });

      expect(element.querySelector('.toolbar')).toBeNull();
    });

    it('asks for the mode chosen, shows it is loading, then names the mode and the matches in it', async () => {
      const { harness, element } = await openWithPicker();

      choose(modeSelect(element), 'competitive');
      harness.detectChanges();

      expect(element.querySelector('table')).toBeNull();
      expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading win rates');

      http.expectOne('/api/hero-stats?mode=competitive').flush({ ...withModes, mode: 'competitive', matchesCounted: 28 });
      harness.detectChanges();

      expect(text(element, '.season-card small')).toContain('Competitive');
      expect(text(element, '.season-card small')).toContain('28 matches');
      expect(modeSelect(element).value).toBe('competitive');
    });

    it('names an empty mode and its half-season, and keeps the picker so the mode can be left', async () => {
      const { harness, element } = await openWithPicker();

      choose(modeSelect(element), 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush({
        ...withModes,
        mode: 'competitive',
        status: 'not-enough-data',
        matchesCounted: 0,
        tiers: [],
        belowMinimum: [],
        modes: MODES.map((mode) => (mode.id === 'competitive' ? { ...mode, decidedMatches: 0 } : mode)),
      });
      harness.detectChanges();

      expect(text(element, '.state-panel h2')).toEqual(['Not enough data yet in Competitive for Season 10.5']);
      expect(modeSelect(element).options.length).toBe(3);
    });

    it('names the mode in the notice when the previous half-season stands in for it', async () => {
      const previous = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: season.startsAt };
      const { harness, element } = await openWithPicker();

      choose(modeSelect(element), 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush({
        ...withModes,
        mode: 'competitive',
        halfSeason: previous,
        inPlaceOf: season,
      });
      harness.detectChanges();

      expect(text(element, '.notice')[0]).toBe(
        "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
      );
    });

    it('keeps the picker when a request for one mode fails', async () => {
      const { harness, element } = await openWithPicker();

      choose(modeSelect(element), 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush('down', { status: 500, statusText: 'Server Error' });
      harness.detectChanges();

      expect(text(element, '.state-panel h2')).toEqual(['Win rates could not be loaded']);
      expect(modeSelect(element).options.length).toBe(3);
    });
  });
});
