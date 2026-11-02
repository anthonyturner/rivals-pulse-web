import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, SessionState } from '../../auth/auth.service';
import { Nav } from './nav';

describe('Nav', () => {
  let component: Nav;
  let fixture: ComponentFixture<Nav>;
  const sessionState = signal<SessionState>({ status: 'signedOut' });

  const accountLink = (): HTMLAnchorElement | undefined =>
    Array.from(
      fixture.nativeElement.querySelectorAll('#primary-navigation .nav-link') as NodeListOf<HTMLAnchorElement>,
    ).find(
      (anchor) =>
        ['Sign in', 'Account'].includes(anchor.textContent?.trim() ?? '') ||
        anchor.getAttribute('href') === '/account',
    );

  beforeEach(async () => {
    sessionState.set({ status: 'signedOut' });

    await TestBed.configureTestingModule({
      imports: [Nav],
      // The app runs zoneless, and the core orb is a router link.
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
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
      fixture.nativeElement.querySelectorAll('#primary-navigation .nav-link') as NodeListOf<HTMLAnchorElement>,
    ).find((anchor) => anchor.textContent?.trim() === 'Community');

    expect(link?.getAttribute('href')).toBe('/community');
  });

  it('offers the core orb as a labelled link to the console', () => {
    const orb = fixture.nativeElement.querySelector('.core-orb') as HTMLAnchorElement | null;

    expect(orb).withContext('the nav renders a core orb').toBeTruthy();
    expect(orb?.getAttribute('aria-label')).toContain('Jarvis console');
    expect(orb?.getAttribute('href')).toContain('jarvis-console');
  });

  it('closes the menu when the orb is followed', () => {
    component.toggleMenu();
    expect(component.isMenuOpen()).toBeTrue();

    const orb = fixture.nativeElement.querySelector('.core-orb') as HTMLAnchorElement;
    // Cancelable, so the router link can stop the anchor navigating the test runner.
    orb.addEventListener('click', (event: Event) => event.preventDefault());
    orb.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(component.isMenuOpen()).toBeFalse();
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

  it('offers My stats to a signed-in visitor only', () => {
    const statsLink = (): HTMLAnchorElement | undefined =>
      Array.from(
        fixture.nativeElement.querySelectorAll('#primary-navigation .nav-link') as NodeListOf<HTMLAnchorElement>,
      ).find((anchor) => anchor.textContent?.trim() === 'My stats');

    expect(statsLink()).toBeUndefined();

    sessionState.set({
      status: 'signedIn',
      account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
      player: null,
    });
    fixture.detectChanges();

    expect(statsLink()?.getAttribute('href')).toBe('/profile');

    sessionState.set({ status: 'signedOut' });
    fixture.detectChanges();

    expect(statsLink()).toBeUndefined();
  });

  it('shows neither link while the session is still being read', () => {
    sessionState.set({ status: 'loading' });
    fixture.detectChanges();

    expect(accountLink()).toBeUndefined();
  });
});
