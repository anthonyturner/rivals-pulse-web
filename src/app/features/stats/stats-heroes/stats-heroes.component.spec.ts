import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { HeroStats, HeroStatsHalfSeason, HeroStatsHero, HeroStatsMode } from '../../../../contracts/hero-stats.model';
import { ThinContent } from '../../../core/seo/thin-content';
import { emptyFigures } from '../../insights/community-extended.fixtures';
import { StatsHeroesComponent } from './stats-heroes.component';

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

function hero(slug: string, appearances: number, wins: number, tier: HeroStatsHero['tier'] = 'B'): HeroStatsHero {
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
const full: HeroStats = {
  ...building,
  status: 'ready',
  matchesCounted: 149,
  halfSeasons: [previous, current],
  tiers: [{ name: 'A', heroes: [hero('storm', 12, 8, 'A'), hero('hela', 20, 9, 'A')] }],
};
const withModes: HeroStats = { ...full, mode: 'all', modes: MODES };

const ROSTER = [
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: null },
  { id: 'hela', name: 'Hela', role: 'Vanguard', imageUrl: null },
];

describe('StatsHeroesComponent', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'stats/heroes', component: StatsHeroesComponent }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  function answer(request: TestRequest, stats: HeroStats | 'failure'): void {
    if (stats === 'failure') {
      request.flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      request.flush(stats);
    }
  }

  /**
   * Opens the tab and answers what it asks for: the community numbers always ask for the current
   * stats, so an address that names a half-season or mode makes a second request, `scoped`.
   */
  async function open(
    url: string,
    stats: HeroStats | 'failure',
    options: { scoped?: string; roster?: unknown[] } = {},
  ): Promise<HTMLElement> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    http.expectOne('/api/community/figures').flush(emptyFigures());
    http.expectOne('/api/heroes').flush(options.roster ?? ROSTER);
    answer(http.expectOne('/api/hero-stats'), stats);

    if (options.scoped !== undefined) {
      answer(http.expectOne(options.scoped), stats);
    }

    harness.detectChanges();

    const page = harness.routeNativeElement as HTMLElement;

    expect(page.textContent).not.toContain('NaN');
    expect(page.textContent).not.toContain('undefined');

    return page;
  }

  /** The part of the tab this issue owns: the community numbers above it are another section's. */
  const section = (page: HTMLElement): HTMLElement => page.querySelector('.all-heroes') as HTMLElement;
  const text = (page: HTMLElement, selector: string): string[] =>
    Array.from(section(page).querySelectorAll(selector)).map((node) => node.textContent?.trim().replace(/\s+/g, ' ') ?? '');
  const toggle = (page: HTMLElement): HTMLAnchorElement[] =>
    Array.from(page.querySelectorAll<HTMLAnchorElement>('.view-toggle a'));
  const live = (page: HTMLElement): string => section(page).querySelector('.visually-hidden[aria-live]')?.textContent?.trim() ?? '';

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function choose(page: HTMLElement, label: string, value: string): Promise<void> {
    const picker = Array.from(section(page).querySelectorAll('.toolbar app-filter-select')).find((element) =>
      element.textContent?.includes(label),
    );
    const select = picker?.querySelector('select') as HTMLSelectElement;

    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  const picker = (page: HTMLElement, label: string): HTMLSelectElement | null =>
    (Array.from(section(page).querySelectorAll('.toolbar app-filter-select')).find((element) =>
      element.textContent?.includes(label),
    )?.querySelector('select') ?? null) as HTMLSelectElement | null;

  describe('the Table and Tiers layouts', () => {
    it('keeps the community hero numbers on the tab, above the layouts', async () => {
      const page = await open('/stats/heroes', full);

      expect(page.querySelector('app-community-heroes-tab')).not.toBeNull();
      expect(page.textContent).toContain('Most picked');
      expect(page.textContent).toContain('Highest win rate');
      expect(page.querySelector('app-community-heroes-tab')?.compareDocumentPosition(section(page))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('opens on the table of every hero, with Table marked as the layout in view', async () => {
      const page = await open('/stats/heroes', full);

      expect(page.querySelector('app-hero-table table')).not.toBeNull();
      expect(page.querySelector('app-hero-tiers')).toBeNull();
      expect(toggle(page).map((link) => [link.textContent?.trim(), link.getAttribute('aria-current')])).toEqual([
        ['Table', 'true'],
        ['Tiers', null],
      ]);
    });

    it('opens on the tier list at ?view=tiers, with Tiers marked as the layout in view', async () => {
      const page = await open('/stats/heroes?view=tiers', full);

      expect(page.querySelector('app-hero-tiers .tier-row')).not.toBeNull();
      expect(page.querySelector('app-hero-table')).toBeNull();
      expect(toggle(page).map((link) => link.getAttribute('aria-current'))).toEqual([null, 'true']);
      expect(text(page, '.tier-letter')).toEqual(['A']);
    });

    it('shows the table for a layout the tab does not have', async () => {
      const page = await open('/stats/heroes?view=grid', full);

      expect(page.querySelector('app-hero-table table')).not.toBeNull();
    });

    it('is two plain links, one address per layout, so each can be linked and followed', async () => {
      const page = await open('/stats/heroes', full);

      expect(page.querySelector('.view-toggle')?.tagName).toBe('NAV');
      expect(page.querySelector('.view-toggle')?.getAttribute('aria-label')).toBe('Hero stats layout');
      expect(toggle(page).map((link) => link.getAttribute('href'))).toEqual(['/stats/heroes', '/stats/heroes?view=tiers']);
    });

    it('keeps the half-season and mode in the other layout’s address', async () => {
      const page = await open('/stats/heroes?season=10&mode=competitive', full, {
        scoped: '/api/hero-stats?halfSeason=10&mode=competitive',
      });

      expect(toggle(page).map((link) => link.getAttribute('href'))).toEqual([
        '/stats/heroes?season=10&mode=competitive',
        '/stats/heroes?season=10&mode=competitive&view=tiers',
      ]);
    });

    it('switches layout without asking for the numbers again', async () => {
      const page = await open('/stats/heroes', full);

      toggle(page)[1].click();
      await settle();

      http.expectNone('/api/hero-stats');
      expect(TestBed.inject(Router).url).toBe('/stats/heroes?view=tiers');
      expect(page.querySelector('app-hero-tiers .tier-row')).not.toBeNull();
      expect(page.querySelector('app-hero-table')).toBeNull();
      expect(live(page)).toBe('');
    });

    it('describes each layout in its own words and links both to how the numbers are counted', async () => {
      const table = await open('/stats/heroes', full);

      expect(text(table, '.all-heroes__lede')[0]).toContain('Win rates, pick rates and ban availability');
      expect(section(table).querySelector('.all-heroes__lede a')?.getAttribute('href')).toBe('/how-we-count');
    });

    it('describes the tier list as ranked by win rate, placed once a hero has enough appearances', async () => {
      const tiers = await open('/stats/heroes?view=tiers', full);

      expect(text(tiers, '.all-heroes__lede')[0]).toContain('Heroes ranked by win rate');
      expect(text(tiers, '.all-heroes__lede')[0]).toContain('placed in a tier');
      expect(section(tiers).querySelector('.all-heroes__lede a')?.getAttribute('href')).toBe('/how-we-count');
    });

    it('explains how every figure is counted under either layout', async () => {
      const page = await open('/stats/heroes?view=tiers', full);

      expect(text(page, '.method-note')[0]).toContain('RivalsPulse has no rank breakdown');
      expect(text(page, '.method-note')[0]).toContain('can exceed 100%');
    });
  });

  describe('the table layout', () => {
    it('shows the win-rates table, its summary and the meta line', async () => {
      const page = await open('/stats/heroes', full);

      expect(text(page, 'tbody .hero-name')).toEqual(['Storm', 'Hela']);
      expect(text(page, 'h3')[0]).toBe('Heroes · Win rate, highest first');
      expect(text(page, '.meta')).toEqual([
        'Quick Match and Competitive · Season 10.5 · Started Oct 9, 2026 · 149 matches with a result · Heroes need 10 appearances to be listed · Bars show win rate; the line marks 50%.',
      ]);
      expect(text(page, '.summary button')).toEqual(['Highest win rateStorm66.7%', 'Most pickedHela10.0%']);
    });

    it('says it is loading until the numbers arrive, without announcing it', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/stats/heroes');
      harness.detectChanges();

      const page = harness.routeNativeElement as HTMLElement;

      expect(section(page).querySelector('[aria-busy="true"]')?.textContent).toContain('Loading hero stats');
      expect(section(page).querySelector('[role="status"]')).toBeNull();
      expect(section(page).querySelector('.toolbar')).toBeNull();

      http.match(() => true);
    });

    it('says the numbers could not be loaded when the request fails, announced once by the live region', async () => {
      const page = await open('/stats/heroes', 'failure');

      expect(text(page, 'app-state-panel h3')).toEqual(['Hero stats could not be loaded']);
      expect(section(page).querySelector('table')).toBeNull();
      expect(section(page).querySelector('[role="status"]')).toBeNull();
      expect(live(page)).toBe('Hero stats could not be loaded');
    });

    it('draws a designed empty state, with no toolbar, when nothing is counted', async () => {
      const page = await open('/stats/heroes', empty);

      expect(text(page, 'app-state-panel h3')).toEqual(['Not enough data yet in Quick Match and Competitive']);
      expect(section(page).querySelector('table')).toBeNull();
      expect(section(page).querySelector('.toolbar')).toBeNull();
    });

    it('is thin content, so ad-free and noindex, while no hero has enough data', async () => {
      await open('/stats/heroes', building);

      expect(TestBed.inject(ThinContent).thin()).toBeTrue();
    });

    it('is thin content when the request fails', async () => {
      await open('/stats/heroes', 'failure');

      expect(TestBed.inject(ThinContent).thin()).toBeTrue();
    });

    it('is not thin content once a hero has enough data', async () => {
      await open('/stats/heroes', full);

      expect(TestBed.inject(ThinContent).thin()).toBeFalse();
    });

    it('labels the previous half-season when it stands in for the current one', async () => {
      const page = await open('/stats/heroes', { ...full, halfSeason: previous, inPlaceOf: current });

      expect(text(page, 'app-notice')[0]).toContain('Season 10.5 does not have enough data yet');
      expect(text(page, '.meta')[0]).toContain('Season 10 ');
    });

    it('says "1 appearance" when one is all a hero needs', async () => {
      const page = await open('/stats/heroes', { ...full, minimumMatches: 1 });

      expect(text(page, '.meta')[0]).toContain('Heroes need 1 appearance to be listed');
    });
  });

  describe('the tiers layout', () => {
    const placed: HeroStats = {
      ...full,
      matchesCounted: 146,
      tiers: [{ name: 'A', heroes: [hero('storm', 12, 8, 'A'), hero('hela', 20, 14, 'A')] }],
      belowMinimum: [{ hero: 'thor', appearances: 2 }],
    };

    it('draws the tier rows with the meta line of the tier list', async () => {
      const page = await open('/stats/heroes?view=tiers', placed);

      expect(text(page, '.hero-name')).toEqual(['Storm', 'Hela']);
      expect(text(page, '.meta')).toEqual([
        'Quick Match and Competitive · Started Oct 9, 2026 · 146 matches with a result · Heroes need 10 appearances to be placed · Each tile: win rate, then pick rate and games.',
      ]);
    });

    it('keeps the meta line off the tab while no hero is placed', async () => {
      const page = await open('/stats/heroes?view=tiers', building);

      expect(section(page).querySelector('.meta')).toBeNull();
      expect(text(page, 'app-state-panel h3')).toEqual(['Not enough data yet in Quick Match and Competitive for Season 10.5']);
    });

    it('says the numbers could not be loaded when the request fails', async () => {
      const page = await open('/stats/heroes?view=tiers', 'failure');

      expect(text(page, 'app-state-panel h3')).toEqual(['Hero stats could not be loaded']);
      expect(section(page).querySelector('.tier-row')).toBeNull();
    });

    it('is thin content until a hero is placed in a tier, and not after', async () => {
      await open('/stats/heroes?view=tiers', building);
      expect(TestBed.inject(ThinContent).thin()).toBeTrue();
    });

    it('is not thin content once a hero is placed in a tier', async () => {
      await open('/stats/heroes?view=tiers', placed);

      expect(TestBed.inject(ThinContent).thin()).toBeFalse();
    });

    it('labels the previous half-season when it stands in for the current one', async () => {
      const page = await open('/stats/heroes?view=tiers', { ...placed, halfSeason: previous, inPlaceOf: current });

      expect(text(page, 'app-notice')[0]).toContain('Season 10.5 does not have enough data yet');
      expect(text(page, '.meta')[0]).toContain('Sep 11, 2026 to Oct 9, 2026');
    });
  });

  describe('the season picker, in both layouts', () => {
    it('is offered only when there is more than one half-season, newest first, with the current one chosen', async () => {
      const page = await open('/stats/heroes', full);

      expect(Array.from((picker(page, 'Season') as HTMLSelectElement).options).map((option) => option.textContent?.trim())).toEqual([
        'Season 10.5',
        'Season 10',
      ]);
      expect((picker(page, 'Season') as HTMLSelectElement).value).toBe('10.5');
    });

    it('is left out when there is only one half-season', async () => {
      const page = await open('/stats/heroes', { ...full, halfSeasons: [current] });

      expect(picker(page, 'Season')).toBeNull();
    });

    for (const [layout, url] of [
      ['table', '/stats/heroes'],
      ['tiers', '/stats/heroes?view=tiers'],
    ] as const) {
      it(`asks for the half-season chosen, puts it in the address, and announces the result once (${layout})`, async () => {
        const page = await open(url, full);

        await choose(page, 'Season', '10');

        expect(TestBed.inject(Router).url).toContain('season=10');
        expect(section(page).querySelector('[aria-busy="true"]')?.textContent).toContain('Loading hero stats');
        expect(section(page).querySelector('table, .tier-row')).toBeNull();
        expect(live(page)).toBe('');
        expect((picker(page, 'Season') as HTMLSelectElement).value).toBe('10');

        http.expectOne('/api/hero-stats?halfSeason=10').flush({ ...full, halfSeason: previous });
        await settle();

        expect(live(page)).toBe('Hero stats updated in Quick Match and Competitive for Season 10: 149 matches with a result');
        expect(section(page).querySelector('table, .tier-row')).not.toBeNull();
        expect((picker(page, 'Season') as HTMLSelectElement).value).toBe('10');
      });
    }

    it('drops season from the address when the current half-season is chosen, and reuses the shared current numbers', async () => {
      const page = await open('/stats/heroes?season=10', full, {
        scoped: '/api/hero-stats?halfSeason=10',
      });

      await choose(page, 'Season', '10.5');

      expect(TestBed.inject(Router).url).toBe('/stats/heroes');
      expect((picker(page, 'Season') as HTMLSelectElement).value).toBe('10.5');
      expect(section(page).querySelector('table, .tier-row')).not.toBeNull();
    });

    it('keeps season in the address for the newest half-season while the plain address stands in the previous one', async () => {
      const page = await open('/stats/heroes', { ...full, halfSeason: previous, inPlaceOf: current });

      await choose(page, 'Season', '10.5');

      expect(TestBed.inject(Router).url).toContain('season=10.5');
      http.expectOne('/api/hero-stats?halfSeason=10.5').flush({ ...full, halfSeason: current });
      await settle();

      expect((picker(page, 'Season') as HTMLSelectElement).value).toBe('10.5');
    });

    it('keeps season in the address for the newest half-season when a mode is picked, since the server stands in per mode', async () => {
      const page = await open('/stats/heroes?mode=competitive', withModes, { scoped: '/api/hero-stats?mode=competitive' });

      await choose(page, 'Season', '10.5');

      expect(TestBed.inject(Router).url).toBe('/stats/heroes?mode=competitive&season=10.5');
      http.expectOne('/api/hero-stats?halfSeason=10.5&mode=competitive').flush({ ...withModes, halfSeason: current });
      await settle();

      expect((picker(page, 'Season') as HTMLSelectElement).value).toBe('10.5');
    });

    it('opens on the half-season the address names, in the layout it names', async () => {
      const page = await open('/stats/heroes?view=tiers&season=10', { ...full, halfSeason: previous }, {
        scoped: '/api/hero-stats?halfSeason=10',
      });

      expect(section(page).querySelector('.tier-row')).not.toBeNull();
      expect((picker(page, 'Season') as HTMLSelectElement).value).toBe('10');
    });

    it('ignores a half-season that is not a number and shows the current one', async () => {
      const page = await open('/stats/heroes?season=week-2', full);

      expect(text(page, 'tbody .hero-name')).toEqual(['Storm', 'Hela']);
    });

    it('announces nothing on the first load', async () => {
      const page = await open('/stats/heroes', full);

      expect(live(page)).toBe('');
    });
  });

  describe('the mode picker, in both layouts', () => {
    it('lists only the modes that hold a decided match, the default first, and never Practice', async () => {
      const page = await open('/stats/heroes', withModes);

      expect(Array.from((picker(page, 'Mode') as HTMLSelectElement).options).map((option) => option.textContent?.trim())).toEqual([
        'Quick Match and Competitive',
        'Quick Match',
        'Competitive',
      ]);
      expect((picker(page, 'Mode') as HTMLSelectElement).value).toBe('all');
      expect(text(page, '.toolbar .filter-select__label')).toEqual(['Mode', 'Season']);
      expect(text(page, '.meta')[0]).not.toContain('Quick Match and Competitive');
    });

    it('draws no picker when only the default blend holds matches, and names the mode in the meta line instead', async () => {
      const page = await open('/stats/heroes', { ...withModes, modes: [MODES[0]] });

      expect(picker(page, 'Mode')).toBeNull();
      expect(text(page, '.meta')[0]).toMatch(/^Quick Match and Competitive · Season 10.5/);
    });

    it('draws no mode picker for an answer cached before modes existed', async () => {
      const page = await open('/stats/heroes', full);

      expect(picker(page, 'Mode')).toBeNull();
    });

    for (const [layout, url] of [
      ['table', '/stats/heroes'],
      ['tiers', '/stats/heroes?view=tiers'],
    ] as const) {
      it(`asks for the mode chosen, stays silent while it loads, then announces the result once (${layout})`, async () => {
        const page = await open(url, withModes);

        await choose(page, 'Mode', 'competitive');

        expect(TestBed.inject(Router).url).toContain('mode=competitive');
        expect(section(page).querySelector('[aria-busy="true"]')?.textContent).toContain('Loading hero stats');
        expect(section(page).querySelector('[role="status"]')).toBeNull();
        expect(live(page)).toBe('');

        http.expectOne('/api/hero-stats?mode=competitive').flush({ ...withModes, mode: 'competitive', matchesCounted: 28 });
        await settle();

        expect(live(page)).toBe('Hero stats updated in Competitive for Season 10.5: 28 matches with a result');
        expect(text(page, '.meta')[0]).toContain('28 matches with a result');
        expect((picker(page, 'Mode') as HTMLSelectElement).value).toBe('competitive');
      });
    }

    it('keeps the chosen half-season when the mode changes', async () => {
      const page = await open('/stats/heroes', withModes);

      await choose(page, 'Season', '10');
      http.expectOne('/api/hero-stats?halfSeason=10').flush({ ...withModes, halfSeason: previous });
      await settle();

      await choose(page, 'Mode', 'quick-match');
      http
        .expectOne('/api/hero-stats?halfSeason=10&mode=quick-match')
        .flush({ ...withModes, halfSeason: previous, mode: 'quick-match' });
      await settle();

      expect(TestBed.inject(Router).url).toBe('/stats/heroes?season=10&mode=quick-match');
    });

    it('shows the shared current stats, without asking again, when the blend is chosen again', async () => {
      const page = await open('/stats/heroes', withModes);

      await choose(page, 'Mode', 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush({ ...withModes, mode: 'competitive', matchesCounted: 28 });
      await settle();

      await choose(page, 'Mode', 'all');

      http.expectNone('/api/hero-stats');
      expect(TestBed.inject(Router).url).toBe('/stats/heroes');
      expect(section(page).querySelector('[aria-busy="true"]')).toBeNull();
      expect((picker(page, 'Mode') as HTMLSelectElement).value).toBe('all');
      expect(text(page, '.meta')[0]).toContain('149 matches with a result');
    });

    it('names an empty mode and its half-season, and keeps the picker so the mode can be left', async () => {
      const page = await open('/stats/heroes', withModes);

      await choose(page, 'Mode', 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush({
        ...withModes,
        mode: 'competitive',
        status: 'not-enough-data',
        matchesCounted: 0,
        tiers: [],
        belowMinimum: [],
        modes: MODES.map((mode) => (mode.id === 'competitive' ? { ...mode, decidedMatches: 0 } : mode)),
      });
      await settle();

      expect(text(page, 'app-state-panel h3')).toEqual(['Not enough data yet in Competitive for Season 10.5']);
      expect(Array.from((picker(page, 'Mode') as HTMLSelectElement).options).map((option) => option.value)).toEqual([
        'all',
        'quick-match',
        'competitive',
      ]);
    });

    it('names the mode in the notice when the previous half-season stands in for it', async () => {
      const page = await open('/stats/heroes', withModes);

      await choose(page, 'Mode', 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush({
        ...withModes,
        mode: 'competitive',
        halfSeason: previous,
        inPlaceOf: current,
      });
      await settle();

      expect(text(page, 'app-notice')[0]).toBe(
        "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
      );
    });

    it('keeps the pickers when a request for one mode fails, and says so in the live region', async () => {
      const page = await open('/stats/heroes', withModes);

      await choose(page, 'Mode', 'competitive');
      http.expectOne('/api/hero-stats?mode=competitive').flush('down', { status: 500, statusText: 'Server Error' });
      await settle();

      expect(text(page, 'app-state-panel h3')).toEqual(['Hero stats could not be loaded']);
      expect((picker(page, 'Mode') as HTMLSelectElement).options.length).toBe(3);
      expect(live(page)).toBe('Hero stats could not be loaded');
    });

    it('offers Arcade on its own once it holds matches, with a warning when it is chosen', async () => {
      const arcadeModes = MODES.map((mode) => (mode.id === 'arcade' ? { ...mode, decidedMatches: 6 } : mode));
      const page = await open('/stats/heroes', { ...withModes, modes: arcadeModes });

      expect(Array.from((picker(page, 'Mode') as HTMLSelectElement).options).map((option) => option.value)).toContain('arcade');
      expect(section(page).querySelector('app-notice')).toBeNull();

      await choose(page, 'Mode', 'arcade');
      http.expectOne('/api/hero-stats?mode=arcade').flush({ ...withModes, mode: 'arcade', modes: arcadeModes });
      await settle();

      expect(text(page, 'app-notice')[0]).toContain('Arcade has custom lobbies');
    });

    it('opens on the mode the address names', async () => {
      const page = await open('/stats/heroes?mode=competitive', { ...withModes, mode: 'competitive' }, {
        scoped: '/api/hero-stats?mode=competitive',
      });

      expect((picker(page, 'Mode') as HTMLSelectElement).value).toBe('competitive');
    });

    it('asks for the blend when the address names a mode the site does not count', async () => {
      const page = await open('/stats/heroes?mode=ranked', withModes);

      expect((picker(page, 'Mode') as HTMLSelectElement).value).toBe('all');
    });
  });
});
