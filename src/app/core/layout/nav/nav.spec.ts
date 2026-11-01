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
    ).find((anchor) => ['Sign in', 'Account'].includes(anchor.textContent?.trim() ?? ''));

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
    });
    fixture.detectChanges();

    expect(accountLink()?.textContent?.trim()).toBe('Account');
    expect(accountLink()?.getAttribute('href')).toBe('/account');
  });

  it('shows neither link while the session is still being read', () => {
    sessionState.set({ status: 'loading' });
    fixture.detectChanges();

    expect(accountLink()).toBeUndefined();
  });
});
