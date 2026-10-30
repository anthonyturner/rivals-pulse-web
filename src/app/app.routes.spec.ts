import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from './app.routes';
import { WinRatesPageComponent } from './features/insights/win-rates/win-rates-page.component';

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

  const emptyStats = {
    status: 'not-enough-data',
    minimumMatches: 10,
    halfSeason: null,
    inPlaceOf: null,
    matchesCounted: 0,
    tiers: [],
    belowMinimum: [],
  };

  /** Follows an address the way a visitor's browser would and returns the page it ended on. */
  async function visit(url: string): Promise<{ finalUrl: string; element: HTMLElement }> {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url);

    http.expectOne('/api/heroes').flush([]);
    http.expectOne('/api/hero-stats').flush(emptyStats);
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

  for (const old of ['/win-rates/9', '/win-rates/8', '/win-rates/week-2', '/win-rates/10.5']) {
    it(`shows the win-rate page, never an error or the hero list, at ${old}`, async () => {
      const { finalUrl, element } = await visit(old);

      expect(finalUrl).toBe(old);
      expect(element.textContent).toContain('Not enough data yet');
      expect(element.textContent).not.toContain('could not be loaded');
    });
  }
});
