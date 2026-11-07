import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { SHOW_UNRELEASED_PAGES } from './released-page.guard';

describe('releasedPageGuard', () => {
  function setUp(showUnreleased: boolean): Router {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: SHOW_UNRELEASED_PAGES, useValue: showUnreleased },
      ],
    });
    return TestBed.inject(Router);
  }

  for (const path of ['/learning-paths', '/watch-next']) {
    it(`sends ${path} to the Tools page while it is coming soon`, async () => {
      const router = setUp(false);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl(path);

      expect(router.url).toBe('/tools');
    });

    it(`still opens ${path} where unreleased pages are shown`, async () => {
      const router = setUp(true);
      const harness = await RouterTestingHarness.create();

      await harness.navigateByUrl(path);

      expect(router.url).toBe(path);
    });
  }

  it('leaves released tools alone', async () => {
    const router = setUp(false);
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/counters');

    expect(router.url).toBe('/counters');
  });
});
