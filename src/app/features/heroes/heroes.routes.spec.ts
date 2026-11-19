import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { App } from '../../app';
import { routes } from '../../app.routes';
import { AuthService, SessionState } from '../../core/auth/auth.service';
import { PageMetaTitleStrategy } from '../../core/seo/page-meta-title.strategy';
import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';
import type { Hero } from './hero.model';
import { HeroesPageComponent } from './heroes-page.component';

const hero = (id: string, name: string, role: Hero['role']): Hero =>
  ({
    id,
    name,
    role,
    difficulty: 3,
    summary: `${name} summary.`,
    playstyle: '',
    strengths: [],
    weaknesses: [],
    counters: [],
    synergies: [],
    abilities: [],
    imageUrl: `/images/heroes/${id}.png`,
  }) as Hero;

const ROSTER = [
  hero('mantis', 'Mantis', 'Strategist'),
  hero('storm', 'Storm', 'Duelist'),
  hero('thor', 'Thor', 'Vanguard'),
];

describe('heroes routes', () => {
  let http: HttpTestingController;
  let router: Router;
  let rosterRequests: number;

  beforeEach(() => {
    rosterRequests = 0;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  /** Answers whatever the page has asked for so far; the roster fails when `roster` is `'fail'`. */
  function answerRequests(roster: Hero[] | 'fail'): void {
    for (const request of http.match(() => true)) {
      if (request.request.url === '/api/heroes') {
        rosterRequests += 1;
        if (roster === 'fail') {
          request.flush('down', { status: 500, statusText: 'Server Error' });
        } else {
          request.flush(roster);
        }
      } else if (request.request.url === '/api/hero-videos') {
        request.flush([]);
      } else {
        request.flush({});
      }
    }
  }

  /** Follows an address like a visitor's browser: the page asks for its data while the router waits. */
  async function visit(
    url: string,
    roster: Hero[] | 'fail' = ROSTER,
  ): Promise<{ harness: RouterTestingHarness; element: HTMLElement }> {
    const harness = await RouterTestingHarness.create();
    await navigate(harness, url, roster);

    return { harness, element: harness.routeNativeElement as HTMLElement };
  }

  async function navigate(
    harness: RouterTestingHarness,
    url: string,
    roster: Hero[] | 'fail' = ROSTER,
  ): Promise<void> {
    let finished = false;
    const navigation = harness.navigateByUrl(url).finally(() => (finished = true));

    while (!finished) {
      await new Promise((resolve) => setTimeout(resolve));
      answerRequests(roster);
    }

    await navigation;
    await settle(harness, roster);
  }

  async function settle(harness: RouterTestingHarness, roster: Hero[] | 'fail' = ROSTER): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      await new Promise((resolve) => setTimeout(resolve));
      answerRequests(roster);
      harness.detectChanges();
    }
  }

  /** A bootstrapped app listens for the browser's Back button; a test bed has to switch that on. */
  function goBack(): void {
    router.setUpLocationChangeListener();
    TestBed.inject(Location).back();
  }

  const canonical = (): HTMLLinkElement | null => document.head.querySelector('link[rel="canonical"]');
  const noindex = (): Element | null => document.head.querySelector('meta[name="robots"][content="noindex"]');
  const rowCount = (element: HTMLElement): number => element.querySelectorAll('.hero-card').length;

  afterEach(() => http.verify());

  describe('the landing at /heroes', () => {
    it('shows the roster with no detail panel and the plain "Heroes" title', async () => {
      const { element } = await visit('/heroes');

      expect(router.url).toBe('/heroes');
      expect(document.title).toBe('Heroes | RivalsPulse');
      expect(rowCount(element)).toBe(3);
      expect(element.querySelector('.hero-detail')).toBeNull();
      expect(element.querySelector('[aria-current="page"]')).toBeNull();
    });

    it('does not pick the first hero for a visitor who picked none', async () => {
      const { element } = await visit('/heroes');

      expect(element.querySelector('h2')).toBeNull();
    });
  });

  describe('a hero at /heroes/:heroId', () => {
    it('shows that hero and titles the page with the hero name, whether opened directly or reached with Back', async () => {
      const { harness, element } = await visit('/heroes/storm');

      expect(document.title).toBe('Storm | RivalsPulse');
      expect(element.querySelector('h2')?.textContent?.trim()).toBe('Storm');
      expect(element.querySelector('[data-hero-id="storm"]')?.getAttribute('aria-current')).toBe('page');

      await navigate(harness, '/heroes/thor');
      expect(document.title).toBe('Thor | RivalsPulse');
      expect(element.querySelector('h2')?.textContent?.trim()).toBe('Thor');

      goBack();
      await settle(harness);

      expect(router.url).toBe('/heroes/storm');
      expect(document.title).toBe('Storm | RivalsPulse');
      expect(element.querySelector('h2')?.textContent?.trim()).toBe('Storm');
    });

    it('keeps one page, and one roster request, as heroes are chosen and closed', async () => {
      const { harness } = await visit('/heroes');
      const landing = harness.routeDebugElement?.componentInstance;

      await navigate(harness, '/heroes/storm');
      expect(harness.routeDebugElement?.componentInstance).toBe(landing);

      await navigate(harness, '/heroes/thor');
      expect(harness.routeDebugElement?.componentInstance).toBe(landing);

      await navigate(harness, '/heroes');
      expect(harness.routeDebugElement?.componentInstance).toBe(landing);
      expect(landing).toBeInstanceOf(HeroesPageComponent);
      expect(rosterRequests).toBe(1);
    });

    it('opens a card with its hero id and keeps the filters in the link', async () => {
      const { harness, element } = await visit('/heroes?role=duelist&q=st');

      const card = element.querySelector('[data-hero-id="storm"]') as HTMLAnchorElement;
      expect(card.getAttribute('href')).toBe('/heroes/storm?role=duelist&q=st');

      card.click();
      await settle(harness);

      expect(router.url).toBe('/heroes/storm?role=duelist&q=st');
      expect(element.querySelector('h2')?.textContent?.trim()).toBe('Storm');
    });

    it('switches the roster from the full grid to the compact roster layout on a hero page, and keeps it as heroes are chosen and closed', async () => {
      const { harness, element } = await visit('/heroes');
      const roster = element.querySelector('app-hero-grid') as HTMLElement;
      expect(roster.getAttribute('layout')).toBe('grid');
      expect(element.querySelector('.view-toggle')).not.toBeNull();

      await navigate(harness, '/heroes/storm');
      expect(element.querySelector('app-hero-grid')).toBe(roster);
      expect(roster.getAttribute('layout')).toBe('roster');
      expect(element.querySelector('.view-toggle')).toBeNull();

      await navigate(harness, '/heroes');
      expect(roster.getAttribute('layout')).toBe('grid');
    });

    it('opens a hero page directly onto the compact roster layout with every hero in it', async () => {
      const { element } = await visit('/heroes/storm');

      expect(element.querySelector('app-hero-grid')?.getAttribute('layout')).toBe('roster');
      expect(rowCount(element)).toBe(3);
    });

    it('offers a link back to all heroes that keeps the filters', async () => {
      const { harness, element } = await visit('/heroes/storm?q=st');

      const back = element.querySelector('a.detail-action') as HTMLAnchorElement;
      expect(back.getAttribute('href')).toBe('/heroes?q=st');

      back.click();
      await settle(harness);

      expect(router.url).toBe('/heroes?q=st');
      expect(element.querySelector('.hero-detail')).toBeNull();
    });
  });

  describe('an address that names no hero', () => {
    it('shows the not-found page, with noindex and no canonical, when typed in', async () => {
      const { harness } = await visit('/heroes/nobody');

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundComponent);
      expect(noindex()).not.toBeNull();
      expect(canonical()).toBeNull();
      expect(document.title).toBe('Page not found | RivalsPulse');
    });

    it('shows the not-found page when an old ?hero= link names one', async () => {
      const { harness } = await visit('/heroes?hero=nobody&q=x');

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundComponent);
      expect(noindex()).not.toBeNull();
      expect(canonical()).toBeNull();
    });

    it('shows the not-found page for a path below a hero', async () => {
      const { harness } = await visit('/heroes/storm/extra');

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(NotFoundComponent);
    });

    it('still matches, and shows the error, when the roster could not be loaded', async () => {
      spyOn(console, 'error');
      const { harness, element } = await visit('/heroes/storm', 'fail');

      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(HeroesPageComponent);
      expect(router.url).toBe('/heroes/storm');
      expect(document.title).toBe('Heroes | RivalsPulse');
      expect(element.textContent).toContain('Heroes could not be loaded');
      expect(element.querySelector('.hero-card')).toBeNull();
    });

    it('asks again after a failed load instead of remembering the failure', async () => {
      spyOn(console, 'error');
      const { harness } = await visit('/heroes', 'fail');
      expect(rosterRequests).toBe(1);

      await navigate(harness, '/heroes/storm');

      expect(rosterRequests).toBe(2);
      expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(HeroesPageComponent);
    });
  });

  describe('an old /heroes?hero= link', () => {
    it('goes to the hero and keeps the other query parameters', async () => {
      const { element } = await visit('/heroes?hero=storm&q=st');

      expect(router.url).toBe('/heroes/storm?q=st');
      expect(element.querySelector('h2')?.textContent?.trim()).toBe('Storm');
    });

    it('goes to the hero when it was the only parameter', async () => {
      await visit('/heroes?hero=thor');

      expect(router.url).toBe('/heroes/thor');
    });

    it('leaves an empty ?hero= on the landing', async () => {
      const { element } = await visit('/heroes?hero=');

      expect(router.url).toBe('/heroes?hero=');
      expect(element.querySelector('.hero-detail')).toBeNull();
    });
  });

  describe('filters in the address', () => {
    it('restores the role from the address', async () => {
      const { element } = await visit('/heroes?role=vanguard');

      expect(rowCount(element)).toBe(1);
      expect(element.querySelector('[data-hero-id="thor"]')).not.toBeNull();
    });

    it('restores the search from the address', async () => {
      const { element } = await visit('/heroes?q=mantis');

      expect(rowCount(element)).toBe(1);
      expect((element.querySelector('input[type="search"]') as HTMLInputElement).value).toBe('mantis');
    });

    it('treats a role that names no role as All', async () => {
      const { element } = await visit('/heroes?role=nonsense');

      expect(rowCount(element)).toBe(3);
    });

    it('changes the roster but not the path, the heading or the chosen hero', async () => {
      const { harness, element } = await visit('/heroes/storm');
      const page = harness.routeDebugElement?.componentInstance as HeroesPageComponent;
      expect(rowCount(element)).toBe(3);

      page.updateSearchTerm('mantis');
      await settle(harness);

      expect(router.url).toBe('/heroes/storm?q=mantis');
      expect(rowCount(element)).toBe(1);
      expect(element.querySelector('h2')?.textContent?.trim()).toBe('Storm');

      page.selectRole('Vanguard');
      await settle(harness);

      expect(router.url).toBe('/heroes/storm?q=mantis&role=vanguard');
      expect(rowCount(element)).toBe(0);
      expect(element.querySelector('h2')?.textContent?.trim()).toBe('Storm');
    });

    it('writes only what is set, and clears both with "Clear filters"', async () => {
      const { harness, element } = await visit('/heroes');
      const page = harness.routeDebugElement?.componentInstance as HeroesPageComponent;

      page.selectRole('Duelist');
      await settle(harness);
      expect(router.url).toBe('/heroes?role=duelist');

      page.selectRole('All');
      await settle(harness);
      expect(router.url).toBe('/heroes');

      page.updateSearchTerm('thor');
      page.selectRole('Vanguard');
      await settle(harness);
      expect(rowCount(element)).toBe(1);

      (element.querySelector('[data-testid="clear-filters"]') as HTMLButtonElement).click();
      await settle(harness);

      expect(router.url).toBe('/heroes');
      expect(rowCount(element)).toBe(3);
    });

    it('replaces the history entry, so Back leaves the filters instead of stepping through them', async () => {
      const { harness } = await visit('/heroes/storm');
      await navigate(harness, '/heroes/thor');
      const page = harness.routeDebugElement?.componentInstance as HeroesPageComponent;

      page.updateSearchTerm('t');
      await settle(harness);
      page.updateSearchTerm('th');
      await settle(harness);
      page.selectRole('Vanguard');
      await settle(harness);
      expect(router.url).toBe('/heroes/thor?q=th&role=vanguard');

      goBack();
      await settle(harness);

      expect(router.url).toBe('/heroes/storm');
    });

    it('keeps text typed into the search box as it is typed', async () => {
      const { harness, element } = await visit('/heroes');
      const input = element.querySelector('input[type="search"]') as HTMLInputElement;

      for (const text of ['m', 'ma', 'man', 'man ']) {
        input.value = text;
        input.dispatchEvent(new Event('input'));
        await settle(harness);

        expect(input.value).toBe(text);
      }

      expect(router.url).toBe('/heroes?q=man%20');
    });

    it('shows the chosen role\'s ability kit for a hero with more than one', async () => {
      const multi = {
        ...hero('deadpool', 'Deadpool', 'Vanguard'),
        roleAbilityKits: [
          { role: 'Vanguard', abilities: [] },
          { role: 'Duelist', abilities: [] },
        ],
      } as unknown as Hero;
      const { harness } = await visit('/heroes/deadpool?role=duelist', [...ROSTER, multi]);
      const page = harness.routeDebugElement?.componentInstance as HeroesPageComponent;

      expect(page.selectedAbilityKitRole()).toBe('Duelist');
      expect(page.heroRoleLabel(multi)).toBe('Duelist');
    });
  });
});

describe('heroes routes inside the app shell', () => {
  let fixture: ComponentFixture<App>;
  let http: HttpTestingController;
  let router: Router;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: { state: signal<SessionState>({ status: 'signedOut' }), load: () => Promise.resolve() },
        },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(App);
    page = fixture.nativeElement as HTMLElement;
  });

  function answerRequests(): void {
    for (const request of http.match(() => true)) {
      if (request.request.url === '/api/heroes') {
        request.flush(ROSTER);
      } else if (request.request.url === '/api/hero-videos') {
        request.flush([]);
      } else {
        request.flush({});
      }
    }
  }

  async function goTo(url: string): Promise<void> {
    let finished = false;
    const navigation = router.navigateByUrl(url).finally(() => (finished = true));

    while (!finished) {
      await new Promise((resolve) => setTimeout(resolve));
      answerRequests();
    }

    await navigation;
    await settle();
  }

  async function settle(): Promise<void> {
    for (let pass = 0; pass < 3; pass++) {
      await new Promise((resolve) => setTimeout(resolve));
      answerRequests();
      fixture.detectChanges();
    }
  }

  const main = (): HTMLElement => page.querySelector('main') as HTMLElement;
  const focused = (): string => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`;

  it('puts focus on the hero name, not on the page, after a hero is chosen from the roster', async () => {
    await goTo('/heroes');
    expect(document.activeElement).not.toBe(main());

    (page.querySelector('[data-hero-id="storm"]') as HTMLAnchorElement).click();
    await settle();

    expect(router.url).toBe('/heroes/storm');
    expect(focused()).toBe('H2:Storm');
  });

  it('puts focus on the new hero name when one hero is switched for another', async () => {
    await goTo('/heroes/storm');

    (page.querySelector('[data-hero-id="thor"]') as HTMLAnchorElement).click();
    await settle();

    expect(router.url).toBe('/heroes/thor');
    expect(focused()).toBe('H2:Thor');
  });

  it('leaves focus on the page when a hero page is opened directly', async () => {
    await goTo('/counters');
    await goTo('/heroes/storm');

    expect(document.activeElement).toBe(main());
  });

  afterEach(() => http.verify());
});
