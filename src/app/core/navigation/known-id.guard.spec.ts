import { provideZonelessChangeDetection, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { HERO_GUIDES } from '../../features/learning/guides/hero-guides/hero-guide-data';
import { HeroGuideDetailPageComponent } from '../../features/learning/guides/hero-guides/hero-guide-detail-page.component';
import { StrategistGuideDetailPageComponent } from '../../features/learning/guides/strategist-guides/strategist-guide-detail-page.component';
import { STRATEGIST_GUIDES } from '../../features/learning/guides/strategist-guides/strategist-guides.data';
import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';

describe('knownIdGuard on the guide routes', () => {
  const response = { status: 200 };

  beforeEach(() => {
    response.status = 200;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: RESPONSE_INIT, useValue: response },
      ],
    });
  });

  it('opens a hero guide for a known id and leaves the status alone', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(`/hero-guides/${HERO_GUIDES[0].heroId}`);

    expect(component).toBeInstanceOf(HeroGuideDetailPageComponent);
    expect(response.status).toBe(200);
  });

  it('opens a strategist guide for a known id and leaves the status alone', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(`/strategist-guides/${STRATEGIST_GUIDES[0].id}`);

    expect(component).toBeInstanceOf(StrategistGuideDetailPageComponent);
    expect(response.status).toBe(200);
  });

  for (const path of ['/hero-guides/nope', '/strategist-guides/nope']) {
    it(`shows the not-found page at ${path}, keeps the address and answers 404`, async () => {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl(path);

      expect(component).toBeInstanceOf(NotFoundComponent);
      expect(TestBed.inject(Router).url).toBe(path);
      expect(response.status).toBe(404);
    });
  }

  it('still opens the first-time guide, which shares the hero guides prefix', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/hero-guides/first-time');

    expect(response.status).toBe(200);
    expect(harness.routeNativeElement?.querySelector('app-not-found')).toBeNull();
  });
});
