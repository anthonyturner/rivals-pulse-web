import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService, SessionState } from '../../auth/auth.service';
import { Nav } from './nav';

@Component({ template: '' })
class PageStub {}

describe('Nav', () => {
  let component: Nav;
  let fixture: ComponentFixture<Nav>;
  const sessionState = signal<SessionState>({ status: 'signedOut' });

  const accountLink = (): HTMLAnchorElement | undefined =>
    Array.from(
      fixture.nativeElement.querySelectorAll('#primary-navigation a.nav-link') as NodeListOf<HTMLAnchorElement>,
    ).find(
      (anchor) =>
        ['Sign in', 'Account'].includes(anchor.textContent?.trim() ?? '') ||
        anchor.getAttribute('href') === '/account',
    );

  beforeEach(async () => {
    sessionState.set({ status: 'signedOut' });

    await TestBed.configureTestingModule({
      imports: [Nav],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: '**', component: PageStub }]),
        { provide: AuthService, useValue: { state: sessionState, load: () => Promise.resolve(sessionState()) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Nav);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers a top-level Community link to the hub', () => {
    const link = Array.from(
      fixture.nativeElement.querySelectorAll('#primary-navigation a.nav-link') as NodeListOf<HTMLAnchorElement>,
    ).find((anchor) => anchor.textContent?.trim() === 'Community');

    expect(link?.getAttribute('href')).toBe('/community');
  });

  it('puts the theme toggle inside the navigation, so the narrow menu holds it too', () => {
    const toggle = fixture.nativeElement.querySelector('#primary-navigation app-theme-toggle button') as HTMLButtonElement | null;

    expect(toggle?.getAttribute('aria-label')).toMatch(/^Switch to (light|dark) theme$/);
  });

  describe('the menu', () => {
    const toggle = (): HTMLButtonElement => fixture.nativeElement.querySelector('.menu-toggle');
    const panel = (): HTMLElement => fixture.nativeElement.querySelector('#primary-navigation');
    const open = async (): Promise<void> => {
      toggle().click();
      await fixture.whenStable();
    };

    it('is a button that says Menu, and tells assistive technology what it opens and whether it is open', async () => {
      expect(toggle().textContent?.trim()).toBe('Menu');
      expect(toggle().getAttribute('aria-label')).toBeNull();
      expect(toggle().getAttribute('aria-controls')).toBe('primary-navigation');
      expect(toggle().getAttribute('aria-expanded')).toBe('false');

      await open();

      expect(toggle().getAttribute('aria-expanded')).toBe('true');
      expect(panel().classList).toContain('is-open');
    });

    it('lists Home first and the account link last', () => {
      const labels = Array.from(panel().querySelectorAll('a, .nav-pending')).map((link) => link.textContent?.trim());

      expect(labels).toEqual(['Home', 'Heroes', 'Guides', 'Tools', 'Resources', 'Community', 'Sign in']);
    });

    it('closes on Escape and puts focus back on the button', async () => {
      await open();
      (panel().querySelector('a') as HTMLElement).focus();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await fixture.whenStable();

      expect(component.isMenuOpen()).toBeFalse();
      expect(document.activeElement).toBe(toggle());
    });

    it('leaves focus alone when Escape is pressed with the menu closed', () => {
      const other = document.createElement('input');
      document.body.appendChild(other);
      other.focus();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(document.activeElement).toBe(other);
      other.remove();
    });

    it('closes when a link is followed', async () => {
      await open();
      const link = panel().querySelector('a') as HTMLAnchorElement;
      // Cancelable, so the router link can stop the anchor navigating the test runner.
      link.addEventListener('click', (event) => event.preventDefault());
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await fixture.whenStable();

      expect(component.isMenuOpen()).toBeFalse();
    });

    it('closes on a click outside it, and stays open on a click inside it', async () => {
      await open();
      panel().click();
      expect(component.isMenuOpen()).toBeTrue();

      document.body.click();
      await fixture.whenStable();

      expect(component.isMenuOpen()).toBeFalse();
    });

    it('closes when focus moves to something outside it, but not to something inside it', async () => {
      const outside = document.createElement('button');
      document.body.appendChild(outside);
      await open();

      toggle().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: panel().querySelector('a') }));
      expect(component.isMenuOpen()).toBeTrue();

      toggle().dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: outside }));
      expect(component.isMenuOpen()).toBeFalse();
      outside.remove();
    });

    it('closes when the page navigates', async () => {
      await open();

      await TestBed.inject(Router).navigateByUrl('/counters');
      await fixture.whenStable();

      expect(component.isMenuOpen()).toBeFalse();
    });

    it('traps no focus: the panel has no tabindex and nothing is inert', () => {
      expect(panel().hasAttribute('tabindex')).toBeFalse();
      expect(panel().hasAttribute('inert')).toBeFalse();
    });
  });

  describe('the current page', () => {
    const current = (): string[] =>
      Array.from(fixture.nativeElement.querySelectorAll('#primary-navigation [aria-current]') as NodeListOf<HTMLElement>).map(
        (link) => `${link.getAttribute('aria-current')}:${link.textContent?.trim()}`,
      );
    const go = async (url: string): Promise<void> => {
      await TestBed.inject(Router).navigateByUrl(url);
      await fixture.whenStable();
    };

    it('marks the link for the page with aria-current', async () => {
      await go('/heroes');

      expect(current()).toEqual(['page:Heroes']);
    });

    it('marks a page under Heroes, Tools or Resources as part of the link it belongs to, not as the page', async () => {
      await go('/heroes/spider-man');
      expect(current()).toEqual(['true:Heroes']);

      await go('/counters?hero=1');
      expect(current()).toEqual(['true:Tools']);

      await go('/glossary#a');
      expect(current()).toEqual(['true:Resources']);

      await go('/tools');
      expect(current()).toEqual(['page:Tools']);
    });

    it('marks Home on the home page only, and nothing on a page with no nav item', async () => {
      await go('/');
      expect(current()).toEqual(['page:Home']);

      await go('/privacy');
      expect(current()).toEqual([]);
    });

    it('marks My stats on the profile page', async () => {
      sessionState.set({
        status: 'signedIn',
        account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
        player: null,
      });
      fixture.detectChanges();
      await go('/profile');

      expect(current()).toEqual(['page:My stats']);
    });

    it('marks the account link on the sign-in and account pages', async () => {
      await go('/sign-in');

      expect(current()).toEqual(['page:Sign in']);
    });
  });

  it('offers Sign in to a signed-out visitor', () => {
    expect(accountLink()?.textContent?.trim()).toBe('Sign in');
    expect(accountLink()?.getAttribute('href')).toBe('/sign-in');
  });

  it('offers Account to a signed-in visitor', () => {
    sessionState.set({
      status: 'signedIn',
      account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
      player: null,
    });
    fixture.detectChanges();

    expect(accountLink()?.textContent?.trim()).toBe('Account');
    expect(accountLink()?.getAttribute('href')).toBe('/account');
  });

  describe('when the account is linked to a player', () => {
    const signInWithPlayer = (name: string, avatarUrl: string | null): void => {
      sessionState.set({
        status: 'signedIn',
        account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
        player: { name, avatarUrl },
      });
      fixture.detectChanges();
    };

    it('shows the in-game name instead of Account, still pointing at the account page', () => {
      signInWithPlayer('Aurora', null);

      expect(accountLink()?.textContent).not.toContain('Account');
      expect(accountLink()?.querySelector('.nav-player-name')?.textContent?.trim()).toBe('Aurora');
      expect(accountLink()?.getAttribute('href')).toBe('/account');
    });

    it('keeps Account in the accessible name', () => {
      signInWithPlayer('Aurora', null);

      expect(accountLink()?.getAttribute('aria-label')).toBe('Account, Aurora');
    });

    it('shows the avatar when there is one, and the first letter when there is not', () => {
      signInWithPlayer('Aurora', 'https://content.overwolf.com/a.png');

      expect(accountLink()?.querySelector('img')?.getAttribute('src')).toBe('https://content.overwolf.com/a.png');

      signInWithPlayer('Aurora', null);

      expect(accountLink()?.querySelector('img')).toBeNull();
      expect(accountLink()?.querySelector('.player-avatar--initial')?.textContent?.trim()).toBe('A');
    });

    it('cuts a long name short with CSS and keeps the whole name in the title', () => {
      const longName = 'AVeryLongInGameNameThatWouldPushTheRowOut';
      signInWithPlayer(longName, null);

      const name = accountLink()?.querySelector('.nav-player-name') as HTMLElement;
      const style = getComputedStyle(name);

      expect(style.textOverflow).toBe('ellipsis');
      expect(style.overflow).toBe('hidden');
      expect(style.whiteSpace).toBe('nowrap');
      expect(accountLink()?.getAttribute('title')).toBe(longName);
      expect(name.textContent?.trim()).toBe(longName);
    });

    it('goes back to Account when the player is unlinked', () => {
      signInWithPlayer('Aurora', null);
      sessionState.set({
        status: 'signedIn',
        account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
        player: null,
      });
      fixture.detectChanges();

      expect(accountLink()?.textContent?.trim()).toBe('Account');
      expect(accountLink()?.getAttribute('aria-label')).toBeNull();
    });
  });

  it('offers My stats to a signed-in visitor only, between Community and the account link', () => {
    const labels = (): (string | undefined)[] =>
      Array.from(fixture.nativeElement.querySelectorAll('#primary-navigation a.nav-link') as NodeListOf<HTMLAnchorElement>).map(
        (anchor) => anchor.textContent?.trim(),
      );
    const statsLink = (): HTMLAnchorElement | undefined =>
      Array.from(
        fixture.nativeElement.querySelectorAll('#primary-navigation a.nav-link') as NodeListOf<HTMLAnchorElement>,
      ).find((anchor) => anchor.textContent?.trim() === 'My stats');

    expect(statsLink()).toBeUndefined();

    sessionState.set({
      status: 'signedIn',
      account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
      player: null,
    });
    fixture.detectChanges();

    expect(statsLink()?.getAttribute('href')).toBe('/profile');
    expect(labels().slice(-3)).toEqual(['Community', 'My stats', 'Account']);

    sessionState.set({ status: 'signedOut' });
    fixture.detectChanges();

    expect(statsLink()).toBeUndefined();
  });

  it('shows neither link while the session is still being read, but keeps its place', () => {
    sessionState.set({ status: 'loading' });
    fixture.detectChanges();

    const placeholder = fixture.nativeElement.querySelector('.nav-pending') as HTMLElement;

    expect(accountLink()).toBeUndefined();
    expect(placeholder.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(placeholder).visibility).toBe('hidden');
  });
});

describe('Nav when the viewport widens', () => {
  let query: { addEventListener: jasmine.Spy; removeEventListener: jasmine.Spy };
  let fixture: ComponentFixture<Nav>;

  beforeEach(async () => {
    query = { addEventListener: jasmine.createSpy('add'), removeEventListener: jasmine.createSpy('remove') };
    spyOn(window, 'matchMedia').and.returnValue(query as unknown as MediaQueryList);

    await TestBed.configureTestingModule({
      imports: [Nav],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { state: signal<SessionState>({ status: 'signedOut' }), load: () => Promise.resolve() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Nav);
    fixture.detectChanges();
  });

  const fire = (matches: boolean): void => {
    const listener = query.addEventListener.calls.mostRecent().args[1] as (event: MediaQueryListEvent) => void;
    listener({ matches } as MediaQueryListEvent);
  };

  it('watches the 920px width the stylesheet switches at', () => {
    expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 920px)');
    expect(query.addEventListener).toHaveBeenCalledOnceWith('change', jasmine.any(Function));
  });

  it('closes an open menu when the viewport becomes wide, and ignores it becoming narrow', () => {
    fixture.componentInstance.toggleMenu();

    fire(false);
    expect(fixture.componentInstance.isMenuOpen()).toBeTrue();

    fire(true);
    expect(fixture.componentInstance.isMenuOpen()).toBeFalse();
  });

  it('stops listening when the nav is destroyed', () => {
    fixture.destroy();

    expect(query.removeEventListener).toHaveBeenCalledOnceWith('change', query.addEventListener.calls.mostRecent().args[1]);
  });
});
