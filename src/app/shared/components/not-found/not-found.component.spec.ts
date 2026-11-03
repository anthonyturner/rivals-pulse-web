import { provideZonelessChangeDetection, RESPONSE_INIT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../app.routes';
import { PageMetaTitleStrategy } from '../../../core/seo/page-meta-title.strategy';
import { NotFoundComponent } from './not-found.component';

const robots = (): string | null =>
  document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;

describe('NotFoundComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
      ],
    });
  });

  it('keeps a mistyped address and shows the page instead of redirecting', async () => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/heros');

    expect(component).toBeInstanceOf(NotFoundComponent);
    expect(TestBed.inject(Router).url).toBe('/heros');
    expect((harness.routeNativeElement as HTMLElement).querySelector('h1')?.textContent).toBe('Page not found');
  });

  it('offers six links to somewhere that exists', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/ai-coach');

    const links = Array.from((harness.routeNativeElement as HTMLElement).querySelectorAll('a'));

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Home',
      'Heroes',
      'Guides',
      'Counters',
      'Tools',
      'Resources',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/',
      '/heroes',
      '/hero-guides',
      '/counters',
      '/tools',
      '/resources',
    ]);
  });

  it('is the only h1 and has no live region, since nothing on it changes', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/nope');

    const page = harness.routeNativeElement as HTMLElement;

    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.querySelector('main, [role="status"], [role="alert"], [aria-live]')).toBeNull();
  });

  it('asks search engines to skip it, and stops asking once the visitor leaves', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/nope');
    expect(robots()).toBe('noindex');

    await harness.navigateByUrl('/tools');
    expect(robots()).toBeNull();
  });

  it('has no canonical address while it shows, and gets the normal one back on the next page', async () => {
    const canonical = (): string | null =>
      document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/tools');
    expect(canonical()).toMatch(/\/tools$/);

    await harness.navigateByUrl('/nope');
    expect(canonical()).toBeNull();

    await harness.navigateByUrl('/resources');
    expect(canonical()).toMatch(/\/resources$/);
  });

  it('makes the server answer 404 (the other tests run with no response, as in the browser, and must not fail)', async () => {
    const response = { status: 200 };

    TestBed.configureTestingModule({ providers: [{ provide: RESPONSE_INIT, useValue: response }] });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/nope');
    expect(response.status).toBe(404);
  });

  it('has a title that says so', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/nope');

    expect(document.title).toBe('Page not found | RivalsPulse');
  });
});
