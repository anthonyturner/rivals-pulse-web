import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';
import { adminGuard } from './core/auth/admin.guard';
import { signedInGuard } from './core/auth/signed-in.guard';
import { ROUTE_NOINDEX } from './core/seo/page-meta-title.strategy';
import { WinRatesPageComponent } from './features/insights/win-rates/win-rates-page.component';
import { OverlayFaqPageComponent } from './features/overlay-faq/overlay-faq-page.component';

describe('win-rate routes', () => {
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => http.verify());

  const partialStats = {
    status: 'not-enough-data',
    minimumMatches: 10,
    halfSeasons: [{ id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null }],
    halfSeason: { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null },
    inPlaceOf: null,
    matchesCounted: 3,
    tiers: [],
    belowMinimum: [{ hero: 'storm', appearances: 3 }],
  };

  /** Follows an address the way a visitor's browser would and returns the page it ended on. */
  async function visit(url: string): Promise<{ finalUrl: string; element: HTMLElement }> {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url);

    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush(partialStats);
    harness.detectChanges();

    expect(component).toBeInstanceOf(WinRatesPageComponent);

    return { finalUrl: router.url, element: harness.routeNativeElement as HTMLElement };
  }

  it('serves the win-rate page at /win-rates', async () => {
    const { finalUrl, element } = await visit('/win-rates');

    expect(finalUrl).toBe('/win-rates');
    expect(element.textContent).toContain('Not enough data yet');
  });

  it('sends the old /season-9-win-rates address to the win-rate page', async () => {
    const { finalUrl } = await visit('/season-9-win-rates');

    expect(finalUrl).toBe('/win-rates');
  });

  for (const old of ['/win-rates/9', '/win-rates/8']) {
    it(`shows the not-shown-here panel, never an error, at ${old}`, async () => {
      const { finalUrl, element } = await visit(old);

      expect(finalUrl).toBe(old);
      expect(element.textContent).toContain('is not shown here');
      expect(element.textContent).not.toContain('could not be loaded');
    });
  }

  for (const shown of ['/win-rates/week-2', '/win-rates/10.5']) {
    it(`shows the current half-season at ${shown}`, async () => {
      const { finalUrl, element } = await visit(shown);

      expect(finalUrl).toBe(shown);
      expect(element.textContent).toContain('Not enough data yet');
      expect(element.textContent).toContain('Season 10.5');
    });
  }
});

describe('FAQ routes', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(routes)],
    });
    router = TestBed.inject(Router);
  });

  for (const [from, to] of [
    ['/faq', '/faq'],
    ['/faq#ban-risk', '/faq#ban-risk'],
    ['/overlay-faq', '/faq'],
    ['/overlay-faq?ref=x#ban-risk', '/faq?ref=x#ban-risk'],
  ]) {
    it(`serves the FAQ page when visiting ${from}`, async () => {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl(from);

      expect(component).toBeInstanceOf(OverlayFaqPageComponent);
      expect(router.url).toBe(to);
    });
  }
});

describe('profile route', () => {
  const profile = routes.find((route) => route.path === 'profile');

  it('is behind the signed-in guard, since the stats are private to the visitor', () => {
    expect(profile?.canActivate).toEqual([signedInGuard]);
  });

  it('has its own title', () => {
    expect(profile?.title).toBe('Your stats | RivalsPulse');
  });
});

describe('admin route', () => {
  const admin = routes.find((route) => route.path === 'admin');

  it('is behind the admin guard and asks not to be indexed', () => {
    expect(admin?.canMatch).toEqual([adminGuard]);
    expect(admin?.data).toEqual(jasmine.objectContaining(ROUTE_NOINDEX));
  });

  it('is the only route, anywhere in the tree, that uses the admin guard or asks not to be indexed', () => {
    const flagged: string[] = [];
    const visit = (list: Routes, path: string): void => {
      for (const route of list) {
        const here = `${path}/${route.path ?? ''}`;

        if (route.canMatch?.includes(adminGuard) || route.canActivate?.includes(adminGuard)) {
          flagged.push(here);
        }

        if (route.data?.['noindex'] === true) {
          flagged.push(`${here} (noindex)`);
        }

        visit(route.children ?? [], here);
      }
    };

    visit(routes, '');

    expect(flagged.sort()).toEqual(['/admin', '/admin (noindex)']);
  });

});

describe('route titles', () => {
  it('ends the Privacy notes tab title in the site name, like the other pages', () => {
    const privacy = routes.find((route) => route.path === 'privacy');

    expect(privacy?.title).toBe('Privacy notes | RivalsPulse');
  });
});
