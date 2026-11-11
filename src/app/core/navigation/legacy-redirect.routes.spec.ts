import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { routes } from '../../app.routes';
import { PULSE_RECORDS_PAGES } from '../../features/records/pulse-records.data';
import { STATS_TABS, statsTabLink } from '../../features/stats/stats-tabs';
import { legacyRedirectRoutes } from './legacy-redirect.routes';
import { LEGACY_REDIRECTS, LEGACY_REDIRECT_PREFIXES } from './legacy-redirects';

@Component({ template: '' })
class BlankPageComponent {}

describe('legacy stat redirects', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([...legacyRedirectRoutes, { path: '**', component: BlankPageComponent }]),
      ],
    });
    router = TestBed.inject(Router);
  });

  async function visit(url: string): Promise<string> {
    await router.navigateByUrl(url);

    return router.url;
  }

  for (const { from, to } of LEGACY_REDIRECTS) {
    it(`sends ${from} to ${to}`, async () => {
      expect(await visit(from)).toBe(to);
    });
  }

  it('sends any other address under /community to the Stats overview', async () => {
    expect(await visit('/community/not-a-tab')).toBe('/stats');
    expect(await visit('/community/not-a-tab/extra')).toBe('/stats');
  });

  it('leaves an unknown Pulse Records list to the not-found page', async () => {
    expect(await visit('/records/speed')).toBe('/records/speed');
  });

  it('covers every Pulse Records list, each to its own category', () => {
    const records = LEGACY_REDIRECTS.filter(({ from }) => from.startsWith('/records/'));

    expect(records.map(({ from, to }) => [from, to])).toEqual(
      PULSE_RECORDS_PAGES.map((page) => [`/records/${page.slug}`, `/stats/records?category=${page.slug}`]),
    );
  });

  it('sends every old address to a real tab of the Stats hub', () => {
    const tabs = new Set(STATS_TABS.map(statsTabLink));

    for (const { from, to } of LEGACY_REDIRECTS) {
      expect(tabs.has(to.split('?')[0])).withContext(`${from} goes to ${to}`).toBeTrue();
    }
  });

  it('is part of the app routes, and no page route answers an old address', () => {
    for (const route of legacyRedirectRoutes) {
      expect(routes).toContain(route);
    }

    const redirected = new Set([...LEGACY_REDIRECTS, ...LEGACY_REDIRECT_PREFIXES].map(({ from }) => from.slice(1)));
    const answering = routes.filter(
      (route) =>
        route.redirectTo === undefined &&
        redirected.has(route.path ?? '') &&
        !route.children?.every((child) => child.redirectTo !== undefined),
    );

    expect(answering).toEqual([]);
  });
});
