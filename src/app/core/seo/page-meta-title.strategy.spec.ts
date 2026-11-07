import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta } from '@angular/platform-browser';
import { provideRouter, Router, Routes, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { NotFoundComponent } from '../../shared/components/not-found/not-found.component';
import { canonicalUrl, PageMetaTitleStrategy, ROUTE_NOINDEX } from './page-meta-title.strategy';
import {
  HOME_TITLE,
  PREVIEW_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_ORIGIN,
} from './site-meta';

@Component({ template: '' })
class BlankComponent {}


const routes: Routes = [
  { path: '', title: HOME_TITLE, component: BlankComponent },
  { path: 'privacy', title: 'Privacy notes', component: BlankComponent },
  { path: 'heroes', component: BlankComponent },
  { path: 'heroes/:heroId', component: BlankComponent },
  { path: 'elsewhere', redirectTo: 'heroes' },
  { path: 'missing', component: NotFoundComponent },
  {
    path: 'admin',
    title: 'Admin',
    data: ROUTE_NOINDEX,
    children: [{ path: 'overview', title: 'Overview', component: BlankComponent }],
  },
];

describe('PageMetaTitleStrategy', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
      ],
    });
    router = TestBed.inject(Router);
  });

  const tag = (key: string): string | null => {
    const attribute = key.startsWith('og:') ? 'property' : 'name';
    return document.head.querySelector(`meta[${attribute}="${key}"]`)?.getAttribute('content') ?? null;
  };
  const canonical = (): string | null =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

  it('sets every preview tag for the homepage', async () => {
    await router.navigateByUrl('/');

    expect(document.title).toBe(HOME_TITLE);
    expect(tag('description')).toBe(SITE_DESCRIPTION);
    expect(tag('og:type')).toBe('website');
    expect(tag('og:title')).toBe(HOME_TITLE);
    expect(tag('og:description')).toBe(SITE_DESCRIPTION);
    expect(tag('og:url')).toBe(`${SITE_ORIGIN}/`);
    expect(tag('og:image')).toBe(`${SITE_ORIGIN}${PREVIEW_IMAGE_PATH}`);
    expect(tag('twitter:card')).toBe('summary_large_image');
    expect(tag('twitter:title')).toBe(HOME_TITLE);
    expect(tag('twitter:description')).toBe(SITE_DESCRIPTION);
    expect(tag('twitter:image')).toBe(`${SITE_ORIGIN}${PREVIEW_IMAGE_PATH}`);
    expect(canonical()).toBe(`${SITE_ORIGIN}/`);
  });

  it('uses the route title and its own address on another page, never the homepage', async () => {
    await router.navigateByUrl('/privacy');

    expect(document.title).toBe('Privacy notes');
    expect(tag('og:title')).toBe('Privacy notes');
    expect(tag('twitter:title')).toBe('Privacy notes');
    expect(tag('og:url')).toBe(`${SITE_ORIGIN}/privacy`);
    expect(canonical()).toBe(`${SITE_ORIGIN}/privacy`);
  });

  it('falls back to the site name for a route without a title', async () => {
    await router.navigateByUrl('/heroes/storm?tab=counters#top');

    expect(document.title).toBe(SITE_NAME);
    expect(tag('og:title')).toBe(SITE_NAME);
    expect(canonical()).toBe(`${SITE_ORIGIN}/heroes/storm`);
  });

  it('uses the address a redirect ends on', async () => {
    await router.navigateByUrl('/elsewhere');

    expect(canonical()).toBe(`${SITE_ORIGIN}/heroes`);
  });

  it('keeps a single canonical link and a single tag per key across navigations', async () => {
    await router.navigateByUrl('/privacy');
    await router.navigateByUrl('/');

    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.head.querySelectorAll('meta[property="og:title"]').length).toBe(1);
    expect(canonical()).toBe(`${SITE_ORIGIN}/`);
  });
});

describe('PageMetaTitleStrategy on a route flagged with ROUTE_NOINDEX', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
      ],
    });
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    document.head.querySelectorAll('meta[name="robots"]').forEach((element) => element.remove());
  });

  const robots = (): string[] =>
    Array.from(document.head.querySelectorAll('meta[name="robots"]')).map(
      (element) => element.getAttribute('content') ?? '',
    );
  const canonical = (): string | null =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

  it('asks not to be indexed or followed, and claims no canonical address, on a child of the flagged route', async () => {
    await router.navigateByUrl('/admin/overview');

    expect(robots()).toEqual(['noindex, nofollow']);
    expect(canonical()).toBeNull();
    expect(document.title).toBe('Overview');
  });

  it('keeps a single robots tag across the flagged routes', async () => {
    await router.navigateByUrl('/admin/overview');
    await router.navigateByUrl('/admin/overview?x=1');

    expect(robots()).toEqual(['noindex, nofollow']);
  });

  it('lets a public page be indexed again, with its canonical, once the visitor leaves', async () => {
    await router.navigateByUrl('/admin/overview');
    await router.navigateByUrl('/privacy');

    expect(robots()).toEqual([]);
    expect(canonical()).toBe(`${SITE_ORIGIN}/privacy`);
  });

  it('leaves a page that is not flagged without a robots tag', async () => {
    await router.navigateByUrl('/privacy');

    expect(robots()).toEqual([]);
  });

  it('leaves the not-found page its own noindex tag when the visitor arrives from a flagged route', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/admin/overview');
    await harness.navigateByUrl('/missing');

    expect(robots()).toEqual(['noindex']);
    expect(canonical()).toBeNull();

    await harness.navigateByUrl('/privacy');

    expect(robots()).toEqual([]);
    expect(canonical()).toBe(`${SITE_ORIGIN}/privacy`);
  });

  it('does not remove a robots tag another page added', async () => {
    const other = TestBed.inject(Meta).addTag({ name: 'robots', content: 'noindex' }, true);

    await router.navigateByUrl('/privacy');

    expect(robots()).toEqual(['noindex']);
    other?.remove();
  });
});

describe('canonicalUrl', () => {
  it('drops the query string and fragment', () => {
    expect(canonicalUrl('/win-rates/10.5?x=1#top')).toBe(`${SITE_ORIGIN}/win-rates/10.5`);
  });
});
