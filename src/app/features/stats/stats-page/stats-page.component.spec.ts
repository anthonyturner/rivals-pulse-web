import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../app.routes';
import { PageMetaTitleStrategy } from '../../../core/seo/page-meta-title.strategy';
import { SITE_ORIGIN } from '../../../core/seo/site-meta';
import { ThinContent } from '../../../core/seo/thin-content';
import { NotFoundComponent } from '../../../shared/components/not-found/not-found.component';
import { emptyFigures, figuresOf, heroFigures } from '../../insights/community-extended.fixtures';
import { heroOf } from '../../insights/hero-matchup.fixtures';
import { statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { recordRows, recordsOf } from '../../records/pulse-records.fixtures';
import { STATS_TABS, statsTabLink, statsTabTitle } from '../stats-tabs';

describe('The Stats hub', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  const page = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const links = (): HTMLAnchorElement[] => Array.from(page().querySelectorAll<HTMLAnchorElement>('nav a'));
  const current = (): string[] =>
    links()
      .filter((link) => link.getAttribute('aria-current') === 'page')
      .map((link) => link.textContent?.trim() ?? '');
  const heading = (): string => page().querySelector('h1')?.textContent?.trim() ?? '';
  const meta = (name: string): string | null =>
    document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null;
  const canonical = (): string | null =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

  /** Opens an address and leaves every request the tab makes unanswered: these specs look at the hub, not the numbers. */
  async function open(url: string): Promise<unknown> {
    const component = await harness.navigateByUrl(url);

    await harness.fixture.whenStable();
    harness.detectChanges();

    return component;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
        { provide: RESPONSE_INIT, useValue: { status: 200 } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.match(() => true);
    document.head
      .querySelectorAll('meta[name="robots"], meta[name="description"], link[rel="canonical"]')
      .forEach((tag) => tag.remove());
  });

  describe('the tab bar', () => {
    it('is a navigation of seven links, one per tab in order, each to its own address', async () => {
      await open('/stats');

      const bar = page().querySelector('nav');

      expect(bar?.getAttribute('aria-label')).toBe('Stats sections');
      expect(links().map((link) => link.textContent?.trim())).toEqual(STATS_TABS.map((tab) => tab.label));
      expect(links().map((link) => link.getAttribute('href'))).toEqual(STATS_TABS.map(statsTabLink));
    });

    it('is plain links, not a script-driven tab list, so each tab can be followed and crawled', async () => {
      await open('/stats');

      expect(page().querySelector('[role="tablist"], [role="tab"]')).toBeNull();
    });

    it('marks the Overview as the current page at /stats, and no other tab', async () => {
      await open('/stats');

      expect(current()).toEqual(['Overview']);
    });

    for (const tab of STATS_TABS) {
      it(`marks only ${tab.label} as the current page at ${statsTabLink(tab)}`, async () => {
        await open(statsTabLink(tab));

        expect(current()).toEqual([tab.label]);
      });
    }

    it('follows the visitor from one tab to another, and back, without losing the bar', async () => {
      await open('/stats');
      const bar = page().querySelector('nav');

      await open('/stats/roles');
      expect(current()).toEqual(['Roles']);
      expect(heading()).toBe('Marvel Rivals role stats');

      await open('/stats');
      expect(current()).toEqual(['Overview']);
      expect(heading()).toBe('Marvel Rivals community stats');
      expect(page().querySelector('nav')).toBe(bar);
    });
  });

  describe('moving between pages that report thin content', () => {
    it('raises no error going from the Overview into Records, out to Roles, and on to the old Records page', async () => {
      const errors = spyOn(console, 'error');

      await open('/stats');
      await open('/stats/records');
      await open('/stats/roles');
      await open('/records');

      expect(errors).not.toHaveBeenCalled();
      expect(heading()).toBe('Pulse Records');
    });
  });

  describe('each tab', () => {
    for (const tab of STATS_TABS) {
      it(`${tab.label} has its own heading, title, description and address`, async () => {
        await open(statsTabLink(tab));

        expect(heading()).toBe(tab.heading);
        expect(TestBed.inject(Title).getTitle()).toBe(statsTabTitle(tab));
        expect(meta('description')).toBe(tab.description);
      });
    }

    it('names its own address as its canonical one once it has content, and none before', async () => {
      await open('/stats/records');

      expect(canonical()).toBeNull();

      http.expectOne('/api/heroes').flush([]);
      http.expectOne('/api/records').flush(recordsOf({ kills: recordRows(6) }));
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(canonical()).toBe(`${SITE_ORIGIN}/stats/records`);
      expect(meta('robots')).toBeNull();
    });
  });

  describe('Heroes', () => {
    const READY_STATS = statsOf([
      { name: 'S', heroes: [statsHero('storm', 20, 14, 13.4, 'S')] },
      { name: 'B', heroes: [statsHero('hela', 30, 15, 20.1)] },
    ]);

    async function answerHeroes(stats: unknown, figures: unknown = figuresOf({}, [heroFigures('hela', { damage: 1050 })])): Promise<void> {
      http.expectOne('/api/community/figures').flush(figures as object);
      http.expectOne('/api/heroes').flush([heroOf('storm', 'Storm', 'Duelist'), heroOf('hela', 'Hela', 'Duelist')]);
      http.expectOne('/api/hero-stats').flush(stats as object);
      await harness.fixture.whenStable();
      harness.detectChanges();
    }

    it('shows the hero numbers, then links to the tier list and the hero stats pages', async () => {
      await open('/stats/heroes');
      await answerHeroes(READY_STATS);
      const hrefs = Array.from(page().querySelectorAll('app-hub-tile a')).map((link) => link.getAttribute('href'));

      expect(page().querySelector('app-stats-heroes app-community-heroes-tab')).not.toBeNull();
      expect(page().textContent).toContain('Most picked');
      expect(page().textContent).toContain('Highest win rate');
      expect(hrefs).toEqual(['/tier-list', '/win-rates']);
    });

    it('is a page with content once a number section has data: an ad, indexable, with its own canonical', async () => {
      await open('/stats/heroes');
      await answerHeroes(READY_STATS);

      expect(TestBed.inject(ThinContent).thin()).toBeFalse();
      expect(meta('robots')).toBeNull();
      expect(canonical()).toBe(`${SITE_ORIGIN}/stats/heroes`);
    });

    it('is thin, with no ad and noindex, when neither number section has data', async () => {
      await open('/stats/heroes');
      await answerHeroes(statsOf([], { matchesCounted: 12 }), emptyFigures());

      expect(TestBed.inject(ThinContent).thin()).toBeTrue();
      expect(meta('robots')).toBe('noindex');
      expect(canonical()).toBeNull();
    });

    it('is not thin while only one of the two sections has data', async () => {
      await open('/stats/heroes');
      await answerHeroes(statsOf([], { matchesCounted: 12 }));

      expect(TestBed.inject(ThinContent).thin()).toBeFalse();
    });
  });

  describe('Maps', () => {
    it('is a stand-in that says the stats are coming, and asks not to be indexed', async () => {
      await open('/stats/maps');

      expect(page().querySelector('app-stats-maps')).not.toBeNull();
      expect(page().textContent).toContain('Map stats are coming soon');
      expect(TestBed.inject(ThinContent).thin()).toBeTrue();
      expect(meta('robots')).toBe('noindex');
      expect(canonical()).toBeNull();
    });
  });

  it('sends an address that names no tab to the not-found page', async () => {
    const component = await open('/stats/nowhere');

    expect(component).toBeInstanceOf(NotFoundComponent);
  });
});
