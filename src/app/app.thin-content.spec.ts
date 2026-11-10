import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy } from '@angular/router';

import { App } from './app';
import { AuthService, SessionState } from './core/auth/auth.service';
import { PageMetaTitleStrategy } from './core/seo/page-meta-title.strategy';
import { SITE_ORIGIN } from './core/seo/site-meta';
import { type ContentState, reportContentState } from './core/seo/thin-content';
import { NotFoundComponent } from './shared/components/not-found/not-found.component';

@Component({ template: '<p>numbers</p>' })
class DataPage {
  static readonly state = signal<ContentState>('thin');

  constructor() {
    reportContentState(() => DataPage.state());
  }
}

describe('A page with too little content, in the app shell', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;

  const shell = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const ad = (): Element | null => shell().querySelector('aside[aria-label="Advertisement"] app-ad-slot');
  const robots = (): string[] =>
    Array.from(document.head.querySelectorAll('meta[name="robots"]')).map((tag) => tag.getAttribute('content') ?? '');
  const canonical = (): string | null =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
  const show = async (state: ContentState): Promise<void> => {
    DataPage.state.set(state);
    await fixture.whenStable();
  };
  const visit = async (url: string): Promise<void> => {
    await router.navigateByUrl(url);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    DataPage.state.set('thin');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'data', title: 'Data', component: DataPage },
          { path: '**', title: 'Page not found', component: NotFoundComponent },
        ]),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
        {
          provide: AuthService,
          useValue: { state: signal<SessionState>({ status: 'signedOut' }), load: () => Promise.resolve() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    await visit('/data');
  });

  afterEach(() => {
    document.head.querySelectorAll('meta[name="robots"], link[rel="canonical"]').forEach((tag) => tag.remove());
  });

  it('shows no sidebar ad and asks not to be indexed while it is below its minimum', () => {
    expect(ad()).toBeNull();
    expect(robots()).toEqual(['noindex']);
    expect(canonical()).toBeNull();
  });

  it('shows the ad and drops noindex, with its canonical address, once the data passes the minimum', async () => {
    await show('ready');

    expect(ad()).not.toBeNull();
    expect(robots()).toEqual([]);
    expect(canonical()).toBe(`${SITE_ORIGIN}/data`);
  });

  it('takes the ad away and asks not to be indexed again if the data drops below the minimum', async () => {
    await show('ready');
    await show('thin');

    expect(ad()).toBeNull();
    expect(robots()).toEqual(['noindex']);
  });

  it('keeps the ad and the index while a ready page loads new numbers', async () => {
    await show('ready');
    await show('loading');

    expect(ad()).not.toBeNull();
    expect(robots()).toEqual([]);
  });

  it('gives an address that names nothing no ad and noindex, even after a page that had content', async () => {
    await show('ready');
    await visit('/nowhere');

    expect(ad()).toBeNull();
    expect(robots()).toEqual(['noindex']);
    expect(canonical()).toBeNull();
  });

  it('returns the ad and the index when the visitor leaves the not-found page for a page with content', async () => {
    await visit('/nowhere');
    DataPage.state.set('ready');
    await visit('/data');

    expect(ad()).not.toBeNull();
    expect(robots()).toEqual([]);
  });
});
