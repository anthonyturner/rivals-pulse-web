import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router, TitleStrategy } from '@angular/router';

import { App } from '../../../app';
import { routes } from '../../../app.routes';
import { AuthService, SessionState } from '../../../core/auth/auth.service';
import { PageMetaTitleStrategy } from '../../../core/seo/page-meta-title.strategy';
import { SITE_ORIGIN } from '../../../core/seo/site-meta';
import { APP_PRIVACY_POLICY } from './app-privacy-policy';
import { APP_PRIVACY_POLICY_DESCRIPTION } from './app-privacy-policy-meta';
import { AppPrivacyPolicyPageComponent } from './app-privacy-policy-page.component';

describe('AppPrivacyPolicyPageComponent', () => {
  let fixture: ComponentFixture<AppPrivacyPolicyPageComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppPrivacyPolicyPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AppPrivacyPolicyPageComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  const flat = (node: Element | null): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('has one h1, the policy title, and shows when the policy was last updated', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(flat(page.querySelector('h1'))).toBe(APP_PRIVACY_POLICY.title);

    const time = page.querySelector('time');

    expect(time?.getAttribute('datetime')).toBe(APP_PRIVACY_POLICY.lastUpdated.iso);
    expect(flat(time)).toBe(APP_PRIVACY_POLICY.lastUpdated.text);
  });

  it('says plainly that the app is not released and points to the site privacy notes', () => {
    const notice = page.querySelector('[role="note"]');

    expect(flat(notice)).toContain('The RivalsPulse desktop app is not released yet.');
    expect(notice?.querySelector('a')?.getAttribute('href')).toBe('/privacy');
  });

  it('renders a labelled h2 section for each policy section, with a contents link to each', () => {
    const sections = Array.from(page.querySelectorAll('section[id]'));

    expect(sections.map((section) => section.id)).toEqual(APP_PRIVACY_POLICY.sections.map((section) => section.id));

    for (const section of APP_PRIVACY_POLICY.sections) {
      expect(page.querySelector(`#${section.id}-title`)?.tagName).withContext(section.id).toBe('H2');
      expect(page.querySelector(`#${section.id}`)?.getAttribute('aria-labelledby')).toBe(`${section.id}-title`);
    }

    expect(page.querySelectorAll('.policy-toc li').length).toBe(APP_PRIVACY_POLICY.sections.length);
  });

  it('renders the policy words, with bold, lists and external links that carry rel noopener', () => {
    expect(flat(page)).toContain('RivalsPulse learns about your matches only from Overwolf');
    expect(page.querySelectorAll('strong').length).toBeGreaterThan(10);
    expect(page.querySelectorAll('li').length).toBeGreaterThan(40);

    const external = Array.from(page.querySelectorAll<HTMLAnchorElement>('.reading-section a[href^="https://"]'));

    expect(external.length).toBeGreaterThan(0);
    expect(external.every((link) => link.rel === 'noopener noreferrer')).toBeTrue();
  });

  it('keeps no stray space before punctuation that follows bold text', () => {
    expect(flat(page)).toContain('Who we are.');
    expect(flat(page)).not.toMatch(/\w \. /);
  });

  it('puts the data table in a keyboard-scrollable region named by its section heading', () => {
    const region = page.querySelector<HTMLElement>('.policy-table');

    expect(region?.getAttribute('role')).toBe('region');
    expect(region?.tabIndex).toBe(0);
    expect(page.querySelector(`#${region?.getAttribute('aria-labelledby')}`)?.tagName).toBe('H2');
    expect(region?.querySelectorAll('th[scope="col"]').length).toBe(3);
  });

  it('writes no markup of its own from policy text', () => {
    expect(page.querySelector('.reading-section script, .reading-section iframe')).toBeNull();
  });
});

describe('the /privacy/app route in the app shell', () => {
  let fixture: ComponentFixture<App>;

  const tag = (key: string): string | null =>
    document.head.querySelector(`meta[name="${key}"]`)?.getAttribute('content') ?? null;
  const canonical = (): string | null =>
    document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes.filter((route) => route.path === 'privacy/app')),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
        {
          provide: AuthService,
          useValue: { state: signal<SessionState>({ status: 'signedOut' }), load: () => Promise.resolve() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/privacy/app');
    await fixture.whenStable();
  });

  afterEach(() => {
    document.head.querySelectorAll('meta[name="robots"], link[rel="canonical"]').forEach((node) => node.remove());
  });

  it('has its own title, description and canonical address', () => {
    expect(document.title).toBe('App privacy policy | RivalsPulse');
    expect(tag('description')).toBe(APP_PRIVACY_POLICY_DESCRIPTION);
    expect(canonical()).toBe(`${SITE_ORIGIN}/privacy/app`);
  });

  it('reports its content as ready, so it is indexed and carries the sidebar ad', () => {
    expect(tag('robots')).toBeNull();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('aside[aria-label="Advertisement"] app-ad-slot'),
    ).not.toBeNull();
  });
});
