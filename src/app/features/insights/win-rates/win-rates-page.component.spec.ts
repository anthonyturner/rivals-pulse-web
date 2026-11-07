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

  const squash = (value: string): string => value.replace(/\s+/g, ' ');

  it('says it is loading until the numbers arrive, without announcing it', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/win-rates');
    harness.detectChanges();

    const element = harness.routeNativeElement as HTMLElement;

    expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading win rates');
    expect(element.querySelector('[role="status"]')).toBeNull();

    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush(empty);
  });

  it('lists each hero with its win rate and record once there is enough data', async () => {
    const element = await open('/win-rates', full);
    const meta = squash(text(element, '.meta')[0]);

    expect(meta).toContain('Season 10.5');
    expect(meta).toContain('149 matches counted');
    expect(meta).toContain('the line marks 50%');
    expect(text(element, 'tbody .hero-name')).toEqual(['Storm', 'Hela']);
    expect(text(element, 'tbody .rate strong')).toEqual(['66.7%', '45.0%']);
    expect(text(element, 'tbody .col-games [aria-hidden="true"]')).toEqual(['8 / 12', '9 / 20']);
    expect(text(element, 'tbody .col-games .visually-hidden')).toEqual([
      '8 wins in 12 games',
      '9 wins in 20 games',
    ]);
    expect(text(element, 'h2')[0]).toBe('Heroes, highest win rate first');
  });

  it('draws a real table: every header names its scope and the heading names the table', async () => {
    const element = await open('/win-rates', full);
    const table = element.querySelector('table') as HTMLTableElement;
    const headers = Array.from(table.querySelectorAll('th'));

    expect(table.getAttribute('aria-labelledby')).toBe('rates-title');
    expect(element.querySelector('#rates-title')?.tagName).toBe('H2');
    expect(headers.every((header) => header.getAttribute('scope') !== null)).toBeTrue();
    expect(text(table, 'thead th')).toEqual(['#Rank', 'Hero', 'Role', 'Win rate', 'Wins / games']);
  });

  it('links each hero to the heroes page and keeps the decorative portrait out of the reading order', async () => {
    const element = await open('/win-rates', full);
    const link = element.querySelector('tbody a') as HTMLAnchorElement;
    const image = link.querySelector('img') as HTMLImageElement;

    expect(link.getAttribute('href')).toBe('/heroes/storm');
    expect(image.getAttribute('alt')).toBe('');
    expect(image.getAttribute('width')).toBe('28');
  });

  it('is a page inside the shell: it adds no main landmark of its own', async () => {
    const element = await open('/win-rates', full);

    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
  });

  it('links its lede to the tier list and to how the numbers are counted', async () => {
    const element = await open('/win-rates', full);
    const hrefs = Array.from(element.querySelectorAll('.lede a')).map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(['/tier-list', '/how-we-count']);
  });

  it('shows heroes still short of the minimum as not enough data yet, beside the full table', async () => {
    const element = await open('/win-rates', full);

    expect(text(element, '.building h2')).toEqual(['Progress toward 10 appearances']);
    expect(text(element, '.building-name')).toEqual(['Storm', 'Thor']);
    expect(text(element, '.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('says "1 appearance" when one is all a hero needs', async () => {
    const element = await open('/win-rates', { ...full, minimumMatches: 1 });

    expect(text(element, '.building h2')).toEqual(['Progress toward 1 appearance']);
    expect(squash(text(element, '.meta')[0])).toContain('Heroes need 1 appearance to be listed');
  });

  it('keeps one live region on the page and leaves static panels out of it', async () => {
    const element = await open('/win-rates', partial);

    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelectorAll('[aria-live]').length).toBe(1);
    expect(element.querySelector('[aria-live]')?.textContent?.trim()).toBe('');
  });

  it('shows the matches counted and no table while no hero has enough data', async () => {
    const element = await open('/win-rates', partial);

    expect(text(element, 'app-state-panel h2')).toEqual([
      'Not enough data yet in Quick Match and Competitive for Season 10.5',
    ]);
    expect(squash(text(element, 'app-state-panel p')[0])).toContain(
      '3 matches counted in Quick Match and Competitive for Season 10.5 so far',
    );
    expect(element.querySelector('table')).toBeNull();
    expect(text(element, '.building-count')).toEqual(['4 of 10', '2 of 10']);
    expect(squash(text(element, '.meta')[0])).not.toContain('the line marks 50%');
  });

  it('draws a designed empty state, not blank panels, when nothing is counted', async () => {
    const element = await open('/win-rates', empty);

    expect(text(element, 'app-state-panel h2')).toEqual(['Not enough data yet in Quick Match and Competitive']);
    expect(squash(text(element, 'app-state-panel p')[0])).toContain(
      'No matches are counted in Quick Match and Competitive yet',
    );
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('.building')).toBeNull();
    expect(element.querySelector('.toolbar')).toBeNull();
    expect(text(element, 'h1')[0].length).toBeGreaterThan(0);
  });

  it('says the numbers could not be loaded when the request fails, announced once by the live region', async () => {
    const element = await open('/win-rates', 'failure');

    expect(text(element, 'app-state-panel h2')).toEqual(['Win rates could not be loaded']);
    expect(element.querySelector('table')).toBeNull();
    expect(element.querySelector('[role="status"]')).toBeNull();
    expect(element.querySelector('[aria-live]')?.textContent?.trim()).toBe('Win rates could not be loaded');
  });

  it('answers an old season address with the empty state and a way to the current numbers', async () => {
    const element = await open('/win-rates/9', { ...full, mode: 'all', modes: MODES });
    const link = element.querySelector<HTMLAnchorElement>('app-state-panel .body > a');

    expect(text(element, 'app-state-panel h2')).toEqual(['Season 9 is not shown here']);
    expect(squash(text(element, 'app-state-panel p')[0])).toContain('latest half-season only');
    expect(element.querySelector('.toolbar')).toBeNull();
    expect(element.querySelector('app-filter-select')).toBeNull();
    expect(element.querySelector('.method-note')).toBeNull();
    expect(element.querySelector('table')).toBeNull();
    expect(link?.textContent).toContain('See Season 10.5 win rates');
    expect(link?.getAttribute('href')).toBe('/win-rates');
    expect(element.querySelector('app-state-panel p a')?.getAttribute('href')).toBe('/tier-list');
  });

  it('shows the served season when the address names it', async () => {
    const element = await open('/win-rates/10.5', full);

    expect(text(element, 'tbody .hero-name')).toEqual(['Storm', 'Hela']);
  });

  it('labels the previous half-season when it stands in for the current one', async () => {
    const previous = { id: 10, label: 'Season 10', startsAt: '2026-09-11T09:00:00Z', endsAt: season.startsAt };
    const element = await open('/win-rates', { ...full, halfSeason: previous, inPlaceOf: season });

    expect(text(element, 'app-notice')[0]).toContain('Season 10.5 does not have enough data yet');
    expect(squash(text(element, '.meta')[0])).toContain('Season 10 ');
  });

  describe('the mode picker', () => {
    const withModes: HeroStats = { ...full, mode: 'all', modes: MODES };
    const modeSelect = (element: HTMLElement): HTMLSelectElement =>
      element.querySelector('app-filter-select select') as HTMLSelectElement;
    const liveRegion = (element: HTMLElement): string =>
      element.querySelector('[aria-live]')?.textContent?.trim() ?? '';

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
      expect(squash(text(element, '.meta')[0])).not.toContain('Quick Match and Competitive');
    });

    it('draws no picker when only the default blend holds matches, and names the mode in the meta line instead', async () => {
      const element = await open('/win-rates', { ...withModes, modes: [MODES[0]] });

      expect(element.querySelector('app-filter-select')).toBeNull();
      expect(squash(text(element, '.meta')[0])).toMatch(/^Quick Match and Competitive · Season 10.5/);
    });

    it('asks for the mode chosen, stays silent while it loads, then announces the result once', async () => {
      const { harness, element } = await openWithPicker();

      choose(modeSelect(element), 'competitive');
      harness.detectChanges();

      expect(element.querySelector('table')).toBeNull();
      expect(element.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading win rates');
      expect(element.querySelector('[role="status"]')).toBeNull();
      expect(liveRegion(element)).toBe('');

      http.expectOne('/api/hero-stats?mode=competitive').flush({ ...withModes, mode: 'competitive', matchesCounted: 28 });
      harness.detectChanges();

      expect(liveRegion(element)).toBe(
        'Win rates updated in Competitive for Season 10.5: 28 matches counted',
      );
      expect(element.querySelectorAll('[aria-live]').length).toBe(1);
      expect(squash(text(element, '.meta')[0])).toContain('28 matches counted');
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

      expect(text(element, 'app-state-panel h2')).toEqual(['Not enough data yet in Competitive for Season 10.5']);
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

      expect(text(element, 'app-notice')[0]).toBe(
        "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
      );
    });

    it('keeps the picker when a request for one mode fails, and says so in the live region', async () => {
      const { harness, element } = await openWithPicker();

      choose(modeSelect(element), 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush('down', { status: 500, statusText: 'Server Error' });
      harness.detectChanges();

      expect(text(element, 'app-state-panel h2')).toEqual(['Win rates could not be loaded']);
      expect(modeSelect(element).options.length).toBe(3);
      expect(liveRegion(element)).toBe('Win rates could not be loaded');
    });
  });
});
