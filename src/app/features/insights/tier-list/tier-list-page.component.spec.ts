import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { HeroStats, HeroStatsHalfSeason, HeroStatsHero, HeroStatsMode } from '../../../../contracts/hero-stats.model';
import { ThinContent } from '../../../core/seo/thin-content';
import { TierListPageComponent } from './tier-list-page.component';

const current: HeroStatsHalfSeason = {
  id: 10.5,
  label: 'Season 10.5',
  startsAt: '2026-10-09T09:00:00Z',
  endsAt: null,
};
const previous: HeroStatsHalfSeason = {
  id: 10,
  label: 'Season 10',
  startsAt: '2026-09-11T09:00:00Z',
  endsAt: current.startsAt,
};

function hero(slug: string, appearances: number, wins: number, tier: HeroStatsHero['tier']): HeroStatsHero {
  return {
    hero: slug,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: 10,
    shrunkWinRate: 50,
    tier,
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
const building: HeroStats = {
  ...empty,
  halfSeasons: [current],
  halfSeason: current,
  matchesCounted: 3,
  belowMinimum: [
    { hero: 'storm', appearances: 4 },
    { hero: 'thor', appearances: 2 },
  ],
};
const partial: HeroStats = {
  ...building,
  status: 'ready',
  matchesCounted: 146,
  tiers: [{ name: 'A', heroes: [hero('storm', 12, 8, 'A'), hero('hela', 20, 14, 'A')] }],
  belowMinimum: [{ hero: 'thor', appearances: 2 }],
};

describe('TierListPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'tier-list', component: TierListPageComponent }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  async function open(stats: HeroStats | 'failure'): Promise<{ harness: RouterTestingHarness; page: HTMLElement }> {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/tier-list');
    http.expectOne('/api/heroes').flush([]);

    const request = http.expectOne('/api/hero-stats');

    if (stats === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(stats);
    }

    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;

    expect(page.textContent).not.toContain('NaN');
    expect(page.textContent).not.toContain('undefined');
    expect(page.textContent?.toLowerCase()).not.toContain('rivals meta');

    return { harness, page };
  }

  const text = (element: HTMLElement, selector: string): string[] =>
    Array.from(element.querySelectorAll(selector)).map((node) => node.textContent?.trim().replace(/\s+/g, ' ') ?? '');

  it('says it is loading until the numbers arrive', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/tier-list');
    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;

    expect(page.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading the tier list');

    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush(empty);
  });

  it('labels the page as based on RivalsPulse players and offers no rank picker or ban column', async () => {
    const { page } = await open(partial);

    expect(page.querySelector('app-page-header')?.firstElementChild?.firstElementChild?.tagName).toBe('H1');
    expect(text(page, 'app-page-header .description')[0]).toContain('RivalsPulse players');
    expect(page.querySelector('select')).toBeNull();
    expect(page.textContent).not.toContain('Ban');
    expect(page.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('links the lead tiles to the How we count explainer and the exact win rates', async () => {
    const { page } = await open(partial);
    const hrefs = Array.from(page.querySelectorAll('app-hub-bento a')).map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(['/how-we-count', '/win-rates']);
  });

  it('is thin content, so ad-free and noindex, until a hero is placed in a tier', async () => {
    await open(building);

    expect(TestBed.inject(ThinContent).thin()).toBeTrue();
  });

  it('is no longer thin content once a hero is placed in a tier', async () => {
    await open(partial);

    expect(TestBed.inject(ThinContent).thin()).toBeFalse();
  });

  it('puts the method note in the lead tile, with decorative key art', async () => {
    const { page } = await open(partial);
    const lead = page.querySelector('app-hub-tile.featured');

    expect(lead?.textContent).toContain('RivalsPulse has no rank breakdown');
    expect(lead?.querySelector('img')?.getAttribute('alt')).toBe('');
    expect(lead?.querySelector('img')?.getAttribute('src')).toBe('/images/site/banners/tier-list-banner.webp');
  });

  it('draws art-led hero tiles that link to their hero', async () => {
    const { page } = await open(partial);
    const tile = page.querySelector('app-tier-rows app-hero-tile');

    expect(tile?.classList).toContain('art-led');
    expect(tile?.querySelector('a')?.getAttribute('href')).toMatch(/^\/heroes\//);
  });

  it('draws a row for each tier that has a hero, with the placed heroes, their sample and the matches counted', async () => {
    const { page } = await open(partial);

    expect(text(page, '.tier-letter')).toEqual(['A']);
    expect(text(page, '.hero-name')).toEqual(['Storm', 'Hela']);
    expect(text(page, '.hero-rate')).toEqual([', win rate 66.7%', ', win rate 70.0%']);
    expect(text(page, '.hero-caption')).toEqual([
      ', pick rate 10.0% pick · , 12 games',
      ', pick rate 10.0% pick · , 20 games',
    ]);
    expect(text(page, '.meta')).toEqual([
      'Started Oct 9, 2026 · 146 matches counted · Heroes need 10 appearances to be placed · Each tile: win rate, then pick rate and games.',
    ]);
  });

  it('lists the tiers and heroes as lists, and announces each tier with its letter and count', async () => {
    const { page } = await open(partial);

    expect(page.querySelectorAll('ol.tiers > li').length).toBe(1);
    expect(page.querySelectorAll('ul.hero-grid > li').length).toBe(2);
    expect(text(page, '.tier-label')).toEqual(['Tier A, 2 heroes']);
    expect(page.querySelector('dl, abbr, table')).toBeNull();
    expect(page.querySelectorAll('app-hero-tile img[alt=""]').length).toBe(2);
  });

  it('says "1 hero" for a tier of one', async () => {
    const { page } = await open({ ...partial, tiers: [{ name: 'S', heroes: [hero('storm', 12, 8, 'S')] }] });

    expect(text(page, '.tier-label')[0]).toBe('Tier S, 1 hero');
  });

  it('keeps the meta line off the page while no hero is placed', async () => {
    const { page } = await open(building);

    expect(page.querySelector('.meta')).toBeNull();
  });

  it('shows a partial dataset as placed heroes plus the rest as not enough data yet, in the same structure', async () => {
    const { page } = await open(partial);

    expect(text(page, '.building h2')).toEqual(['Progress toward a tier']);
    expect(text(page, '.building-name')).toEqual(['Thor']);
    expect(text(page, '.building-count')).toEqual(['2 of 10']);
    expect(text(page, '.building .section-heading p')).toEqual([
      'Heroes need 10 appearances before they are placed in a tier.',
    ]);
    expect(page.querySelectorAll('.tier-row').length).toBe(1);
  });

  it('draws no tier rows while no hero has enough data, and says how many matches are counted', async () => {
    const { page } = await open(building);

    expect(text(page, 'app-state-panel h2')).toEqual(['Not enough data yet in Quick Match and Competitive for Season 10.5']);
    expect(text(page, '.state-count')[0]).toBe(
      '3 matches counted in Quick Match and Competitive for Season 10.5 so far.',
    );
    expect(text(page, 'app-state-panel p')[1]).toContain('built from matches that RivalsPulse players record');
    expect(page.querySelector('.tier-row')).toBeNull();
    expect(text(page, '.building-count')).toEqual(['4 of 10', '2 of 10']);
  });

  it('draws a designed empty state when nothing is counted', async () => {
    const { page } = await open(empty);

    expect(text(page, 'app-state-panel h2')).toEqual(['Not enough data yet in Quick Match and Competitive']);
    expect(text(page, '.state-count')[0]).toBe('No matches counted in Quick Match and Competitive so far.');
    expect(page.querySelector('.tier-row')).toBeNull();
    expect(page.querySelector('.building')).toBeNull();
    expect(text(page, 'h1')).toEqual(['Marvel Rivals tier list']);
  });

  it('says the numbers could not be loaded when the request fails', async () => {
    const { page } = await open('failure');

    expect(text(page, 'app-state-panel h2')).toEqual(['The tier list could not be loaded']);
    expect(page.querySelector('.tier-row')).toBeNull();
  });

  it('labels the previous half-season when it stands in for the current one', async () => {
    const { page } = await open({ ...partial, halfSeason: previous, inPlaceOf: current, halfSeasons: [previous, current] });

    expect(text(page, '.notice')[0]).toContain('Season 10.5 does not have enough data yet');
    expect(text(page, '.meta')[0]).toContain('Sep 11, 2026 to Oct 9, 2026');
  });

  it('offers a season picker only when there is more than one half-season, and asks for the one chosen', async () => {
    const { harness, page } = await open({ ...partial, halfSeasons: [previous, current] });
    const select = page.querySelector('select') as HTMLSelectElement;

    expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
      'Season 10.5',
      'Season 10',
    ]);
    expect(select.value).toBe('10.5');

    select.value = '10';
    select.dispatchEvent(new Event('change'));
    harness.detectChanges();

    expect(page.querySelector('.tier-row')).toBeNull();
    expect(page.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading the tier list');
    expect(text(page, '[aria-live]')).toEqual(['']);
    expect(select.value).toBe('10');

    http.expectOne('/api/hero-stats?halfSeason=10').flush({ ...partial, halfSeason: previous });
    harness.detectChanges();

    expect(text(page, '[aria-live]')).toEqual([
      'Tier list updated in Quick Match and Competitive for Season 10: 146 matches counted',
    ]);
    expect(select.value).toBe('10');
  });

  it('announces nothing on the first load', async () => {
    const { page } = await open({ ...partial, halfSeasons: [previous, current] });

    expect(text(page, '[aria-live]')).toEqual(['']);
  });

  describe('the mode picker', () => {
    const withModes: HeroStats = { ...partial, mode: 'all', modes: MODES, halfSeasons: [previous, current] };

    function modeSelect(page: HTMLElement): HTMLSelectElement {
      const mode = Array.from(page.querySelectorAll('app-filter-select')).find((element) =>
        element.textContent?.includes('Mode'),
      );

      return mode?.querySelector('select') as HTMLSelectElement;
    }

    function seasonSelect(page: HTMLElement): HTMLSelectElement {
      const season = Array.from(page.querySelectorAll('app-filter-select')).find((element) =>
        element.textContent?.includes('Season'),
      );

      return season?.querySelector('select') as HTMLSelectElement;
    }

    function choose(select: HTMLSelectElement, value: string): void {
      select.value = value;
      select.dispatchEvent(new Event('change'));
    }

    it('lists only the modes that hold a decided match, the default first, and never Practice', async () => {
      const { page } = await open(withModes);
      const select = modeSelect(page);

      expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
        'Quick Match and Competitive',
        'Quick Match',
        'Competitive',
      ]);
      expect(select.value).toBe('all');
    });

    it('sits beside the season picker and the meta line in one toolbar', async () => {
      const { page } = await open(withModes);

      expect(text(page, '.toolbar .filter-select__label')).toEqual(['Mode', 'Season']);
      expect(page.querySelector('.toolbar .meta')).not.toBeNull();
    });

    it('draws no picker when only the default blend holds matches', async () => {
      const { page } = await open({ ...withModes, halfSeasons: [current], modes: [MODES[0]] });

      expect(page.querySelector('select')).toBeNull();
    });

    it('draws no mode picker for an answer cached before modes existed', async () => {
      const { page } = await open({ ...partial, halfSeasons: [previous, current] });

      expect(text(page, '.filter-select__label')).toEqual(['Season']);
    });

    it('asks for the mode chosen, shows it is loading, then names the mode and the matches in it', async () => {
      const { harness, page } = await open(withModes);

      choose(modeSelect(page), 'competitive');
      harness.detectChanges();

      expect(page.querySelector('.tier-row')).toBeNull();
      expect(page.querySelector('[aria-busy="true"]')?.textContent).toContain('Loading the tier list');

      http.expectOne('/api/hero-stats?mode=competitive').flush({ ...withModes, mode: 'competitive', matchesCounted: 28 });
      harness.detectChanges();

      expect(text(page, '.meta')[0]).toContain('28 matches counted');
      expect(text(page, '[aria-live]')).toEqual(['Tier list updated in Competitive for Season 10.5: 28 matches counted']);
      expect(modeSelect(page).value).toBe('competitive');
    });

    it('keeps the chosen half-season when the mode changes', async () => {
      const { harness, page } = await open(withModes);

      choose(seasonSelect(page), '10');
      harness.detectChanges();
      http.expectOne('/api/hero-stats?halfSeason=10').flush({ ...withModes, halfSeason: previous });
      harness.detectChanges();

      choose(modeSelect(page), 'quick-match');
      harness.detectChanges();

      http
        .expectOne('/api/hero-stats?halfSeason=10&mode=quick-match')
        .flush({ ...withModes, halfSeason: previous, mode: 'quick-match' });
    });

    it('goes back to the default request when the blend is chosen again', async () => {
      const { harness, page } = await open(withModes);

      choose(modeSelect(page), 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush({ ...withModes, mode: 'competitive' });
      harness.detectChanges();

      choose(modeSelect(page), 'all');
      http.expectOne('/api/hero-stats').flush(withModes);
    });

    it('names an empty mode and its half-season, and keeps the picker so the mode can be left', async () => {
      const { harness, page } = await open(withModes);

      choose(modeSelect(page), 'competitive');
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

      expect(text(page, 'app-state-panel h2')).toEqual(['Not enough data yet in Competitive for Season 10.5']);
      expect(text(page, '.state-count')[0]).toBe('No matches counted in Competitive for Season 10.5 so far.');
      expect(Array.from(modeSelect(page).options).map((option) => option.value)).toEqual([
        'all',
        'quick-match',
        'competitive',
      ]);
    });

    it('names the mode in the notice when the previous half-season stands in for it', async () => {
      const { harness, page } = await open(withModes);

      choose(modeSelect(page), 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush({
        ...withModes,
        mode: 'competitive',
        halfSeason: previous,
        inPlaceOf: current,
      });
      harness.detectChanges();

      expect(text(page, '.notice')[0]).toBe(
        "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
      );
    });

    it('keeps the pickers when a request for one mode fails', async () => {
      const { harness, page } = await open(withModes);

      choose(modeSelect(page), 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush('down', { status: 500, statusText: 'Server Error' });
      harness.detectChanges();

      expect(text(page, 'app-state-panel h2')).toEqual(['The tier list could not be loaded']);
      expect(modeSelect(page).options.length).toBe(3);
    });

    it('offers Arcade on its own once it holds matches, with a warning when it is chosen', async () => {
      const arcadeModes = MODES.map((mode) => (mode.id === 'arcade' ? { ...mode, decidedMatches: 6 } : mode));
      const { harness, page } = await open({ ...withModes, modes: arcadeModes });

      expect(Array.from(modeSelect(page).options).map((option) => option.value)).toContain('arcade');
      expect(page.querySelector('.notice')).toBeNull();

      choose(modeSelect(page), 'arcade');
      http.expectOne('/api/hero-stats?mode=arcade').flush({ ...withModes, mode: 'arcade', modes: arcadeModes });
      harness.detectChanges();

      expect(text(page, '.notice')[0]).toContain('Arcade has custom lobbies');
    });
  });
});
