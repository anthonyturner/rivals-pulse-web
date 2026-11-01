import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuthService, SessionState } from '../../core/auth/auth.service';
import { AccountPageComponent } from './account-page.component';
import { SignInPageComponent } from './sign-in-page.component';

const ACCOUNT = { email: 'player@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };
const SIGNED_IN: SessionState = { status: 'signedIn', account: ACCOUNT };

function setup(session: SessionState) {
  const state = signal<SessionState>(session);
  const auth = {
    state,
    load: jasmine.createSpy('load').and.callFake(() => Promise.resolve(state())),
    signOut: jasmine.createSpy('signOut').and.callFake(async () => state.set({ status: 'signedOut' })),
  };

  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([
        { path: 'sign-in', component: SignInPageComponent },
        { path: 'account', component: AccountPageComponent },
        { path: '', component: AccountPageComponent },
      ]),
      { provide: AuthService, useValue: auth },
    ],
  });

  return { auth, state };
}

const page = (harness: RouterTestingHarness): HTMLElement => harness.routeNativeElement as HTMLElement;

describe('AccountPageComponent', () => {
  it('shows the sign-in method, email and created date', async () => {
    setup(SIGNED_IN);
    const text = page(await RouterTestingHarness.create('/account')).textContent ?? '';

    expect(text).toContain('Discord');
    expect(text).toContain('player@example.com');
    expect(text).toContain('November 1, 2026');
  });

  it('says so when no email was shared', async () => {
    setup({ status: 'signedIn', account: { ...ACCOUNT, email: null } });

    expect(page(await RouterTestingHarness.create('/account')).textContent).toContain('None shared with us');
  });

  it('signs out and goes home', async () => {
    const { auth } = setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/account');

    page(harness).querySelector('button')?.click();
    await harness.fixture.whenStable();

    expect(auth.signOut).toHaveBeenCalled();
    expect(TestBed.inject(Router).url).toBe('/');
  });
});

describe('SignInPageComponent', () => {
  const discordLink = (harness: RouterTestingHarness): HTMLAnchorElement =>
    page(harness).querySelector('a.account-button') as HTMLAnchorElement;

  it('offers Discord and carries the return address to the server', async () => {
    setup({ status: 'signedOut' });
    const link = discordLink(await RouterTestingHarness.create('/sign-in?next=%2Faccount'));

    expect(link.textContent).toContain('Sign in with Discord');
    expect(link.getAttribute('href')).toBe('/api/auth/discord/start?next=%2Faccount');
  });

  it('will not carry an off-site return address', async () => {
    setup({ status: 'signedOut' });
    const link = discordLink(await RouterTestingHarness.create('/sign-in?next=%2F%2Fevil.example'));

    expect(link.getAttribute('href')).toBe('/api/auth/discord/start?next=%2Faccount');
  });

  it('explains a cancelled sign-in', async () => {
    setup({ status: 'signedOut' });
    const harness = await RouterTestingHarness.create('/sign-in?error=cancelled');

    expect(page(harness).querySelector('[role="alert"]')?.textContent).toContain('cancelled');
  });

  it('sends a visitor who is already signed in on to where they were going', async () => {
    setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/sign-in?next=%2Faccount');

    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/account');
  });
});
