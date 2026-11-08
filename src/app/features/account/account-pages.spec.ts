import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  AuthService,
  DeleteAccountResult,
  LinkChangeResult,
  RecordsOptInResult,
  SessionState,
} from '../../core/auth/auth.service';
import type { LinkedPlayer } from '../../core/auth/linked-player.types';
import { AccountPageComponent } from './account-page.component';
import { SignInPageComponent } from './sign-in-page.component';

const ACCOUNT = { email: 'player@example.com', provider: 'discord', createdAt: '2026-11-01T10:00:00Z' };
const SIGNED_IN: SessionState = { status: 'signedIn', account: ACCOUNT, player: null, isAdmin: false };

function setup(
  session: SessionState,
  deletion: DeleteAccountResult = { status: 'deleted' },
  linkChange: LinkChangeResult = { status: 'done' },
  linkedAfter: LinkedPlayer | null = null,
  optIn: { loaded?: RecordsOptInResult; saved?: (show: boolean) => RecordsOptInResult } = {},
) {
  const state = signal<SessionState>(session);
  const auth = {
    state,
    load: jasmine.createSpy('load').and.callFake(() => Promise.resolve(state())),
    signOut: jasmine.createSpy('signOut').and.callFake(async () => state.set({ status: 'signedOut' })),
    deleteAccount: jasmine.createSpy('deleteAccount').and.callFake(async () => {
      if (deletion.status !== 'failed') {
        state.set({ status: 'signedOut' });
      }

      return deletion;
    }),
    linkPlayer: jasmine.createSpy('linkPlayer').and.callFake(async () => changeLink(linkedAfter)),
    unlinkPlayer: jasmine.createSpy('unlinkPlayer').and.callFake(async () => changeLink(null)),
    loadRecordsOptIn: jasmine
      .createSpy('loadRecordsOptIn')
      .and.callFake(async () => optIn.loaded ?? { status: 'ready', showInRecords: false }),
    setRecordsOptIn: jasmine.createSpy('setRecordsOptIn').and.callFake(async (show: boolean) => {
      const result: RecordsOptInResult = optIn.saved?.(show) ?? { status: 'ready', showInRecords: show };

      if (result.status === 'signedOut') {
        state.set({ status: 'signedOut' });
      }

      return result;
    }),
  };

  /** What the real service does to its state once the server has answered a link change. */
  function changeLink(player: LinkedPlayer | null): LinkChangeResult {
    if (linkChange.status === 'done' && session.status === 'signedIn') {
      state.set({ ...session, player });
    } else if (linkChange.status === 'signedOut') {
      state.set({ status: 'signedOut' });
    }

    return linkChange;
  }

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
    setup({ status: 'signedIn', account: { ...ACCOUNT, email: null }, player: null, isAdmin: false });

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

describe('AccountPageComponent deletion', () => {
  const deleteButton = (harness: RouterTestingHarness): HTMLButtonElement =>
    page(harness).querySelector('.danger') as HTMLButtonElement;
  const phraseInput = (harness: RouterTestingHarness): HTMLInputElement =>
    page(harness).querySelector('#delete-confirmation') as HTMLInputElement;

  async function type(harness: RouterTestingHarness, text: string): Promise<void> {
    const input = phraseInput(harness);

    input.value = text;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  it('has one deletion, with no radio choices', async () => {
    setup(SIGNED_IN);
    const root = page(await RouterTestingHarness.create('/account'));

    expect(root.querySelectorAll('input[type="radio"], fieldset').length).toBe(0);
    expect(root.textContent).toContain('Forgetting the matches the desktop app uploaded is not available yet.');
  });

  it('has the details and delete panels, and no "What we keep" panel', async () => {
    setup(SIGNED_IN);
    const headings = Array.from(page(await RouterTestingHarness.create('/account')).querySelectorAll('h2')).map(
      (heading) => heading.textContent?.trim(),
    );

    expect(headings).toEqual(['Sign-in details', 'Link the desktop app', 'Pulse Records', 'Delete your account']);
  });

  it('keeps the delete button off until the phrase is typed', async () => {
    const { auth } = setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/account');

    expect(deleteButton(harness).disabled).toBeTrue();

    await type(harness, 'delete');
    expect(deleteButton(harness).disabled).toBeTrue();

    await type(harness, 'delete my account');
    expect(deleteButton(harness).disabled).toBeFalse();
    expect(auth.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account and shows the sign-in page with a notice', async () => {
    const { auth } = setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/account');

    await type(harness, 'delete my account');
    deleteButton(harness).click();
    await harness.fixture.whenStable();

    expect(auth.deleteAccount).toHaveBeenCalledOnceWith({ mode: 'account', confirmation: 'delete my account' });
    expect(TestBed.inject(Router).url).toBe('/sign-in?notice=deleted');
  });

  it('shows why it failed, announces it once, and lets the player try again', async () => {
    const { auth } = setup(SIGNED_IN, { status: 'failed', message: 'Try again in a moment.' });
    const harness = await RouterTestingHarness.create('/account');

    await type(harness, 'delete my account');
    deleteButton(harness).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page(harness).querySelector('#delete-error')?.textContent).toContain('Try again in a moment.');
    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('Try again in a moment.');
    expect(page(harness).querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).toBe(1);
    expect(phraseInput(harness).getAttribute('aria-describedby')).toBe('delete-error');
    expect(TestBed.inject(Router).url).toBe('/account');
    expect(deleteButton(harness).disabled).toBeFalse();
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it('disables nothing while the deletion is in flight, so focus stays put, and ignores a second submit', async () => {
    const { auth } = setup(SIGNED_IN);
    let finish: (result: DeleteAccountResult) => void = () => undefined;

    auth.deleteAccount.and.callFake(() => new Promise<DeleteAccountResult>((resolve) => (finish = resolve)));
    const harness = await RouterTestingHarness.create('/account');
    const deleteForm = page(harness).querySelector('#delete-confirmation')?.closest('form') as HTMLFormElement;

    await type(harness, 'delete my account');
    phraseInput(harness).focus();
    deleteForm.dispatchEvent(new Event('submit', { cancelable: true }));
    deleteForm.dispatchEvent(new Event('submit', { cancelable: true }));
    harness.detectChanges();

    expect(deleteForm.getAttribute('aria-busy')).toBe('true');
    expect(phraseInput(harness).readOnly).toBeTrue();
    expect(page(harness).querySelectorAll(':disabled:not(.guide-button):not(#records-opt-in)').length).toBe(0);
    expect(deleteButton(harness).disabled).toBeFalse();
    expect(deleteButton(harness).textContent).toContain('Deleting…');
    expect(document.activeElement).toBe(phraseInput(harness));
    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);

    finish({ status: 'deleted' });
    await harness.fixture.whenStable();
  });

  it('sends a player whose last sign-in is too old to sign in again, with a reason', async () => {
    const { auth } = setup(SIGNED_IN, { status: 'signInAgain' });
    const harness = await RouterTestingHarness.create('/account');

    await type(harness, 'delete my account');
    deleteButton(harness).click();
    await harness.fixture.whenStable();

    expect(auth.deleteAccount).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Router).url).toBe('/sign-in?next=%2Faccount&notice=reauth');
  });

  it('sends a player whose session had already ended to sign in', async () => {
    setup(SIGNED_IN, { status: 'signedOut' });
    const harness = await RouterTestingHarness.create('/account');

    await type(harness, 'delete my account');
    deleteButton(harness).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/sign-in?next=%2Faccount');
  });
});

describe('AccountPageComponent linking', () => {
  const AURORA = { name: 'Aurora', avatarUrl: null };
  const LINKED: SessionState = { status: 'signedIn', account: ACCOUNT, player: AURORA, isAdmin: false };
  const codeInput = (harness: RouterTestingHarness): HTMLInputElement =>
    page(harness).querySelector('#link-code') as HTMLInputElement;
  const linkButton = (harness: RouterTestingHarness): HTMLButtonElement =>
    page(harness).querySelector('form button[type="submit"]') as HTMLButtonElement;
  const unlinkButton = (harness: RouterTestingHarness): HTMLButtonElement | undefined =>
    Array.from(page(harness).querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Unlink');

  async function typeCode(harness: RouterTestingHarness, text: string): Promise<void> {
    const input = codeInput(harness);

    input.value = text;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    await harness.fixture.whenStable();
  }

  it('asks an unlinked account for a code', async () => {
    setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/account');

    expect(page(harness).textContent).toContain('Link the desktop app');
    expect(codeInput(harness)).toBeTruthy();
    expect(unlinkButton(harness)).toBeUndefined();
  });

  it('says only the player sees the page, and that a public name on Pulse Records is a choice', async () => {
    setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/account');
    const text = (page(harness).textContent ?? '').replace(/\s+/g, ' ');

    expect(text).not.toContain('Nothing here is shown to anyone else');
    expect(text).toContain('Only you see this page');
    expect(text).toContain('only if you choose that');
    expect(text).toContain('Linking publishes nothing');
  });

  it('says the linked name and avatar are for the player only, with the name on Pulse Records a choice', async () => {
    setup(SIGNED_IN, undefined, { status: 'done' }, AURORA);
    const harness = await RouterTestingHarness.create('/account');

    await typeCode(harness, 'abcd-efgh');
    linkButton(harness).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    const text = (page(harness).textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('to you only');
    expect(text).toContain('Your name goes on the public Pulse Records page only if you choose that, and your avatar never does');
  });

  it('keeps Link off until something is typed, and sends the code as typed', async () => {
    const { auth } = setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/account');

    expect(linkButton(harness).disabled).toBeTrue();

    await typeCode(harness, 'abcd-efgh');
    expect(linkButton(harness).disabled).toBeFalse();

    linkButton(harness).click();
    await harness.fixture.whenStable();

    expect(auth.linkPlayer).toHaveBeenCalledOnceWith('abcd-efgh');
  });

  it('shows the linked name and an Unlink button once linked', async () => {
    setup(SIGNED_IN, undefined, { status: 'done' }, AURORA);
    const harness = await RouterTestingHarness.create('/account');

    await typeCode(harness, 'abcd-efgh');
    linkButton(harness).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page(harness).querySelector('.player strong')?.textContent).toBe('Aurora');
    expect(codeInput(harness)).toBeNull();
    expect(unlinkButton(harness)).toBeTruthy();
  });

  it('shows the message from the server for a refused code and keeps the code typed', async () => {
    setup(SIGNED_IN, undefined, { status: 'failed', message: 'That code is wrong or has expired. Get a new one from the desktop app.' });
    const harness = await RouterTestingHarness.create('/account');

    await typeCode(harness, 'abcd-efgh');
    linkButton(harness).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page(harness).querySelector('#link-code-error')?.textContent).toContain('wrong or has expired');
    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('wrong or has expired');
    expect(page(harness).querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).toBe(1);
    expect(codeInput(harness).value).toBe('abcd-efgh');
  });

  it('ties the message for a refused code to the input', async () => {
    setup(SIGNED_IN, undefined, { status: 'failed', message: 'That code is wrong or has expired. Get a new one from the desktop app.' });
    const harness = await RouterTestingHarness.create('/account');

    expect(codeInput(harness).getAttribute('aria-describedby')).toBeNull();

    await typeCode(harness, 'abcd-efgh');
    linkButton(harness).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(codeInput(harness).getAttribute('aria-invalid')).toBe('true');
    expect(codeInput(harness).getAttribute('aria-describedby')).toBe('link-code-error');
    expect(page(harness).querySelector('#link-code-error')?.textContent).toContain('wrong or has expired');
  });

  it('announces a successful link and moves focus to the section heading, since the button is gone', async () => {
    setup(SIGNED_IN, undefined, { status: 'done' }, AURORA);
    const harness = await RouterTestingHarness.create('/account');

    await typeCode(harness, 'abcd-efgh');
    linkButton(harness).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('linked to Aurora');
    expect(document.activeElement).toBe(page(harness).querySelector('#account-link-title'));
  });

  it('announces an unlink and moves focus to the section heading', async () => {
    setup(LINKED);
    const harness = await RouterTestingHarness.create('/account');

    unlinkButton(harness)?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('unlinked');
    expect(document.activeElement).toBe(page(harness).querySelector('#account-link-title'));
  });

  it('keeps the code box and Link button enabled while linking, so focus stays put', async () => {
    const { auth } = setup(SIGNED_IN);
    let finish: (result: LinkChangeResult) => void = () => undefined;

    auth.linkPlayer.and.callFake(() => new Promise<LinkChangeResult>((resolve) => (finish = resolve)));
    const harness = await RouterTestingHarness.create('/account');

    await typeCode(harness, 'abcd-efgh');
    codeInput(harness).focus();
    codeInput(harness).closest('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    codeInput(harness).closest('form')?.dispatchEvent(new Event('submit', { cancelable: true }));
    harness.detectChanges();

    expect(codeInput(harness).readOnly).toBeTrue();
    expect(codeInput(harness).disabled).toBeFalse();
    expect(linkButton(harness).disabled).toBeFalse();
    expect(linkButton(harness).textContent).toContain('Linking…');
    expect(document.activeElement).toBe(codeInput(harness));
    expect(auth.linkPlayer).toHaveBeenCalledTimes(1);

    finish({ status: 'done' });
    await harness.fixture.whenStable();
  });

  it('keeps Unlink enabled while unlinking and ignores a second click', async () => {
    const { auth } = setup(LINKED);
    let finish: (result: LinkChangeResult) => void = () => undefined;

    auth.unlinkPlayer.and.callFake(() => new Promise<LinkChangeResult>((resolve) => (finish = resolve)));
    const harness = await RouterTestingHarness.create('/account');
    const button = Array.from(page(harness).querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.trim() === 'Unlink',
    ) as HTMLButtonElement;

    button.focus();
    button.click();
    harness.detectChanges();
    button.click();
    harness.detectChanges();

    expect(button.disabled).toBeFalse();
    expect(button.textContent).toContain('Unlinking…');
    expect(document.activeElement).toBe(button);
    expect(auth.unlinkPlayer).toHaveBeenCalledTimes(1);

    finish({ status: 'done' });
    await harness.fixture.whenStable();
  });

  it('sends a visitor whose session ended to sign in', async () => {
    setup(SIGNED_IN, undefined, { status: 'signedOut' });
    const harness = await RouterTestingHarness.create('/account');

    await typeCode(harness, 'abcd-efgh');
    linkButton(harness).click();
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/sign-in?next=%2Faccount');
  });

  it('unlinks, and offers a code again', async () => {
    const { auth } = setup(LINKED);
    const harness = await RouterTestingHarness.create('/account');

    expect(page(harness).querySelector('.player strong')?.textContent).toBe('Aurora');

    unlinkButton(harness)?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(auth.unlinkPlayer).toHaveBeenCalledTimes(1);
    expect(codeInput(harness)).toBeTruthy();
    expect(unlinkButton(harness)).toBeUndefined();
  });

  it('keeps the link shown and says why when unlinking fails', async () => {
    setup(LINKED, undefined, { status: 'failed', message: 'Linking is unavailable right now.' });
    const harness = await RouterTestingHarness.create('/account');

    unlinkButton(harness)?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('unavailable');
    expect(page(harness).querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).toBe(1);
    expect(page(harness).querySelector('.player strong')?.textContent).toBe('Aurora');
  });
});

describe('AccountPageComponent Pulse Records switch', () => {
  const AURORA = { name: 'Aurora', avatarUrl: null };
  const LINKED: SessionState = { status: 'signedIn', account: ACCOUNT, player: AURORA, isAdmin: false };
  const checkbox = (harness: RouterTestingHarness): HTMLInputElement =>
    page(harness).querySelector('#records-opt-in') as HTMLInputElement;
  const announcement = (harness: RouterTestingHarness): string =>
    page(harness).querySelector('[role="status"]')?.textContent?.trim() ?? '';

  /** Opens the page and waits for the setting to load, which starts once the page has drawn. */
  async function open(): Promise<RouterTestingHarness> {
    const harness = await RouterTestingHarness.create('/account');

    await harness.fixture.whenStable();
    harness.detectChanges();

    return harness;
  }

  async function toggle(harness: RouterTestingHarness): Promise<void> {
    checkbox(harness).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('is a labelled native checkbox, described by its help text', async () => {
    setup(LINKED);
    const harness = await open();
    const box = checkbox(harness);
    const label = page(harness).querySelector('label[for="records-opt-in"]');

    expect(box.type).toBe('checkbox');
    expect(label?.textContent?.trim()).toBe('Show me in Pulse Records');
    expect(page(harness).querySelector(`#${box.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'appears beside the entries from matches your own desktop app uploaded',
    );
  });

  it('is off by default for a linked player, and never pre-ticked', async () => {
    const { auth } = setup(LINKED);
    const harness = await open();

    expect(checkbox(harness).checked).toBeFalse();
    expect(checkbox(harness).disabled).toBeFalse();
    expect(auth.setRecordsOptIn).not.toHaveBeenCalled();
  });

  it('shows the setting the server holds', async () => {
    setup(LINKED, undefined, undefined, undefined, { loaded: { status: 'ready', showInRecords: true } });
    const harness = await open();

    expect(checkbox(harness).checked).toBeTrue();
  });

  it('is disabled and explained, and asks the server nothing, until a player is linked', async () => {
    const { auth } = setup(SIGNED_IN);
    const harness = await open();
    const help = page(harness).querySelector(`#${checkbox(harness).getAttribute('aria-describedby')}`);

    expect(checkbox(harness).disabled).toBeTrue();
    expect(checkbox(harness).checked).toBeFalse();
    expect(help?.textContent).toContain('Link the desktop app above to turn this on');
    expect(auth.loadRecordsOptIn).not.toHaveBeenCalled();
  });

  it('saves on and announces it, and saves off and announces that', async () => {
    const { auth } = setup(LINKED);
    const harness = await open();

    await toggle(harness);

    expect(auth.setRecordsOptIn).toHaveBeenCalledOnceWith(true);
    expect(checkbox(harness).checked).toBeTrue();
    expect(announcement(harness)).toBe('Show me in Pulse Records is on. Your name can appear on Pulse Records.');

    await toggle(harness);

    expect(auth.setRecordsOptIn).toHaveBeenCalledWith(false);
    expect(checkbox(harness).checked).toBeFalse();
    expect(announcement(harness)).toBe('Show me in Pulse Records is off. Your name is not shown on Pulse Records.');
  });

  it('can be operated from the keyboard', async () => {
    const { auth } = setup(LINKED);
    const harness = await open();

    checkbox(harness).focus();
    checkbox(harness).click();
    await harness.fixture.whenStable();

    expect(document.activeElement).toBe(checkbox(harness));
    expect(auth.setRecordsOptIn).toHaveBeenCalledOnceWith(true);
  });

  it('puts the box back and says why when the save fails', async () => {
    setup(LINKED, undefined, undefined, undefined, {
      saved: () => ({ status: 'failed', message: 'Your Pulse Records setting could not be saved right now.' }),
    });
    const harness = await open();

    await toggle(harness);

    expect(checkbox(harness).checked).toBeFalse();
    expect(page(harness).textContent).toContain('could not be saved right now');
    expect(announcement(harness)).toContain('could not be saved right now');
  });

  it('stays off and says so when the saved setting cannot be loaded, rather than guessing', async () => {
    setup(LINKED, undefined, undefined, undefined, {
      loaded: { status: 'failed', message: 'Your Pulse Records setting could not be loaded right now.' },
    });
    const harness = await open();

    expect(checkbox(harness).disabled).toBeTrue();
    expect(page(harness).textContent).toContain('could not be loaded right now');
  });

  it('is switched off and fixed once the desktop app is unlinked', async () => {
    const { auth } = setup(LINKED, undefined, undefined, undefined, { loaded: { status: 'ready', showInRecords: true } });
    const harness = await open();

    expect(checkbox(harness).checked).toBeTrue();

    Array.from(page(harness).querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Unlink')
      ?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(auth.unlinkPlayer).toHaveBeenCalled();
    expect(checkbox(harness).checked).toBeFalse();
    expect(checkbox(harness).disabled).toBeTrue();
  });

  it('reads the setting again after a new link, which starts off', async () => {
    const { auth } = setup(SIGNED_IN, undefined, { status: 'done' }, AURORA);
    const harness = await open();
    const input = page(harness).querySelector('#link-code') as HTMLInputElement;

    input.value = 'abcd-efgh';
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
    (page(harness).querySelector('form button[type="submit"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(auth.loadRecordsOptIn).toHaveBeenCalledTimes(1);
    expect(checkbox(harness).checked).toBeFalse();
    expect(checkbox(harness).disabled).toBeFalse();
  });

  it('sends a signed-out player to sign in', async () => {
    setup(LINKED, undefined, undefined, undefined, { saved: () => ({ status: 'signedOut' }) });
    const harness = await open();

    await toggle(harness);

    expect(TestBed.inject(Router).url).toContain('/sign-in');
  });
});

describe('SignInPageComponent', () => {
  const discordLink = (harness: RouterTestingHarness): HTMLAnchorElement =>
    page(harness).querySelector('a.guide-button') as HTMLAnchorElement;

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

    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('cancelled');
    expect(page(harness).querySelector('[role="alert"]')).toBeNull();
  });

  it('shows one message when several apply, in the order error, notice, unavailable', async () => {
    setup({ status: 'unavailable' });
    const harness = await RouterTestingHarness.create('/sign-in?error=failed&notice=deleted');
    const text = page(harness).textContent ?? '';

    expect(text).toContain('Discord sign-in did not complete');
    expect(text).not.toContain('account has been deleted');
    expect(text).not.toContain('could not check whether you are signed in');
    expect(page(harness).querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).toBe(1);
  });

  it('says the session could not be checked, and still offers the button', async () => {
    setup({ status: 'unavailable' });
    const harness = await RouterTestingHarness.create('/sign-in');

    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain(
      'We could not check whether you are signed in. You can still sign in.',
    );
    expect(discordLink(harness)).toBeTruthy();
    expect(page(harness).querySelector('[role="alert"]')).toBeNull();
  });

  it('shows no message when there is nothing to say, but keeps the one live region', async () => {
    setup({ status: 'signedOut' });
    const harness = await RouterTestingHarness.create('/sign-in');

    expect(page(harness).querySelectorAll('[role="status"]').length).toBe(1);
    expect(page(harness).querySelector('[role="status"]')?.textContent?.trim()).toBe('');
    expect(page(harness).querySelector('h2')).toBeNull();
  });

  it('confirms that the account was deleted', async () => {
    setup({ status: 'signedOut' });
    const harness = await RouterTestingHarness.create('/sign-in?notice=deleted');

    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('account has been deleted');
  });

  it('explains why to sign in again, and stays put although the visitor is signed in', async () => {
    setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/sign-in?next=%2Faccount&notice=reauth');

    await harness.fixture.whenStable();

    expect(page(harness).querySelector('[role="status"]')?.textContent).toContain('Sign in again to delete');
    expect(TestBed.inject(Router).url).toBe('/sign-in?next=%2Faccount&notice=reauth');
    expect(discordLink(harness).getAttribute('href')).toBe('/api/auth/discord/start?next=%2Faccount');
  });

  it('shows nothing for a key that is a name on every object, not a message', async () => {
    for (const url of ['/sign-in?error=constructor', '/sign-in?notice=toString', '/sign-in?error=__proto__']) {
      TestBed.resetTestingModule();
      setup({ status: 'signedOut' });
      const harness = await RouterTestingHarness.create(url);

      expect(page(harness).querySelector('[role="status"]')?.textContent?.trim()).toBe('');
      expect(page(harness).textContent).not.toContain('function');
    }
  });

  it('ignores a notice it does not know', async () => {
    setup({ status: 'signedOut' });
    const harness = await RouterTestingHarness.create('/sign-in?notice=anything');

    expect(page(harness).querySelector('[role="status"]')?.textContent?.trim()).toBe('');
  });

  it('replaces the button with a loading panel for a visitor who is already signed in', () => {
    setup(SIGNED_IN);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ next: '/account', error: 'failed' }) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(SignInPageComponent);
    const root = fixture.nativeElement as HTMLElement;

    fixture.detectChanges();

    expect(root.querySelector('a.guide-button')).toBeNull();
    expect(root.querySelector('[role="status"]')?.textContent).toContain('You are already signed in');
    expect(root.querySelector('[aria-busy="true"]')).toBeNull();
    expect(root.textContent).not.toContain('did not complete');
    expect(root.querySelectorAll('[role="status"], [role="alert"], [aria-live]').length).toBe(1);
  });

  it('sends a visitor who is already signed in on to where they were going', async () => {
    setup(SIGNED_IN);
    const harness = await RouterTestingHarness.create('/sign-in?next=%2Faccount');

    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe('/account');
  });
});
