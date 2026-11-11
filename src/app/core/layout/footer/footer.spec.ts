import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routes } from '../../../app.routes';
import { DISCORD_INVITE_URL } from '../../../shared/discord-invite';
import { declaresRoute } from '../../../testing/declared-routes';
import { GoogleConsentService } from '../../consent/google-consent.service';
import { NAVIGATION_CATEGORIES } from '../../navigation/navigation-category.data';
import { Footer } from './footer';
import { FOOTER_COLUMNS } from './footer-links';

describe('Footer', () => {
  const canChangeChoice = signal(false);
  const reopenChoices = jasmine.createSpy('reopenChoices');
  let fixture: ComponentFixture<Footer>;

  const page = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const settingsButton = (): HTMLButtonElement | null =>
    page().querySelector<HTMLButtonElement>('button.site-footer__link');

  beforeEach(async () => {
    canChangeChoice.set(false);
    reopenChoices.calls.reset();

    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: GoogleConsentService, useValue: { canChangeChoice, reopenChoices } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    fixture.detectChanges();
  });

  it('shows the shared brand linking home, a tagline and the get-app button', () => {
    expect(page().querySelector('app-brand a.brand')?.getAttribute('aria-label')).toBe('RivalsPulse home');
    expect(page().querySelector('app-brand img.brand-mark')?.getAttribute('alt')).toBe('');
    expect(page().querySelector('.site-footer__tagline')?.textContent).toContain('Marvel Rivals');
    expect(page().querySelector('app-get-app-button')).withContext('the shared get-app button').toBeTruthy();
  });

  it('groups its links into labelled columns', () => {
    const columns = Array.from(page().querySelectorAll<HTMLElement>('nav[aria-label="Footer"] .site-footer__column'));

    expect(columns.map((column) => column.querySelector('h2')?.textContent?.trim())).toEqual([
      'Stats & tools',
      'Learn',
      'RivalsPulse',
    ]);
    columns.forEach((column) => {
      const heading = column.querySelector('h2') as HTMLElement;
      expect(column.querySelector('ul')?.getAttribute('aria-labelledby')).toBe(heading.id);
    });
    expect(page().querySelector('a[href="/glossary"]')?.textContent?.trim()).toBe('Glossary');
  });

  it('links only to declared routes the nav does not mark disabled', () => {
    const disabled = new Set(
      NAVIGATION_CATEGORIES.flatMap((category) => category.items)
        .filter((item) => !item.enabled)
        .map((item) => item.path),
    );

    FOOTER_COLUMNS.flatMap((column) => column.links).forEach(({ path }) => {
      expect(declaresRoute(routes, path)).withContext(`${path} is a declared route`).toBeTrue();
      expect(disabled.has(path)).withContext(`${path} is released`).toBeFalse();
    });
  });

  it('links to the Discord in a new tab', () => {
    const link = page().querySelector<HTMLAnchorElement>('a.site-footer__discord');

    expect(link?.getAttribute('href')).toBe(DISCORD_INVITE_URL);
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
  });

  it('leaves the Discord link out when there is no invite', async () => {
    fixture.componentRef.setInput('discordUrl', '');
    await fixture.whenStable();

    expect(page().querySelector('a.site-footer__discord')).toBeNull();
  });

  it('carries the copyright line for the current year', () => {
    expect(page().querySelector('.site-footer__legal')?.textContent).toContain(
      `© ${new Date().getFullYear()} RivalsPulse.`,
    );
  });

  it('links to the privacy notes', () => {
    const link = page().querySelector('a[href="/privacy"]') as HTMLAnchorElement | null;

    expect(link).withContext('the footer has a privacy link').toBeTruthy();
    expect(link?.textContent?.trim()).toBe('Privacy notes');
  });

  it('links to the Fair play and privacy page from the RivalsPulse column', () => {
    const column = page().querySelector('#footer-rivalspulse')?.closest('.site-footer__column');
    const link = column?.querySelector('a[href="/fair-play"]') as HTMLAnchorElement | null;

    expect(link).withContext('the RivalsPulse column has a fair play link').toBeTruthy();
    expect(link?.textContent?.trim()).toBe('Fair play and privacy');
  });

  it('links to the desktop app privacy policy from the RivalsPulse column', () => {
    const column = page().querySelector('#footer-rivalspulse')?.closest('.site-footer__column');
    const link = column?.querySelector('a[href="/privacy/app"]') as HTMLAnchorElement | null;

    expect(link).withContext('the RivalsPulse column has an app privacy policy link').toBeTruthy();
    expect(link?.textContent?.trim()).toBe('App privacy policy');
  });

  it('keeps saying the site is an independent fan project', () => {
    const text = (page().textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('RivalsPulse is an independent project, not affiliated with NetEase, Marvel or Overwolf.');
  });

  it('offers no privacy settings button where Google shows no consent message', () => {
    expect(settingsButton()).toBeNull();
  });

  it('offers a privacy settings button where Google shows its message, and reopens the message on click', async () => {
    canChangeChoice.set(true);
    await fixture.whenStable();

    expect(settingsButton()?.textContent?.trim()).toBe('Privacy and cookie settings');

    settingsButton()?.click();

    expect(reopenChoices).toHaveBeenCalledTimes(1);
  });
});
