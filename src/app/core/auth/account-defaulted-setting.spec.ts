import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { RememberedSetting } from '../../shared/utilities/remembered-setting';
import { accountDefaultedSetting } from './account-defaulted-setting';
import { AuthService } from './auth.service';
import type { MediaDefaults } from './media-defaults.types';

type Choice = 'on' | 'off';

const ACCOUNT = { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' };

describe('accountDefaultedSetting', () => {
  let auth: AuthService;
  let browser: RememberedSetting<Choice> & { saved: jasmine.Spy };

  const signIn = (mediaDefaults: MediaDefaults | null): void =>
    auth.state.set({ status: 'signedIn', account: ACCOUNT, player: null, isAdmin: false, mediaDefaults });

  const create = () =>
    TestBed.runInInjectionContext(() =>
      accountDefaultedSetting<Choice>(browser, ({ sound }) => (sound ? 'on' : 'off')),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    auth = TestBed.inject(AuthService);
    const remembered = signal<Choice>('off');
    const saved = jasmine.createSpy('remembered.set').and.callFake((value: Choice) => remembered.set(value));
    browser = { value: remembered.asReadonly(), set: saved, saved };
  });

  it('is the browser-remembered choice while signed out, and remembers a change as before', () => {
    const setting = create();

    expect(setting.value()).toBe('off');

    setting.set('on');

    expect(setting.value()).toBe('on');
    expect(browser.saved).toHaveBeenCalledOnceWith('on');
  });

  it('is the browser-remembered choice while the session is still loading or unavailable', () => {
    browser.set('on');
    const setting = create();

    expect(auth.state().status).toBe('loading');
    expect(setting.value()).toBe('on');

    auth.state.set({ status: 'unavailable' });

    expect(setting.value()).toBe('on');
  });

  it('takes the account default over the browser-remembered choice once signed in', () => {
    browser.set('on');
    const setting = create();

    signIn({ heroVideo: false, sound: false });

    expect(setting.value()).toBe('off');

    signIn({ heroVideo: false, sound: true });

    expect(setting.value()).toBe('on');
  });

  it('changes for this visit only: it overrides the account default without saving it anywhere', () => {
    const setting = create();
    signIn({ heroVideo: false, sound: true });
    browser.saved.calls.reset();

    setting.set('off');

    expect(setting.value()).toBe('off');
    expect(browser.saved).not.toHaveBeenCalled();
    expect(auth.mediaDefaults()).toEqual({ heroVideo: false, sound: true });
  });

  it('goes back to the account default on the next visit, which is a new instance reading the same account', () => {
    signIn({ heroVideo: false, sound: true });
    create().set('off');

    expect(create().value()).toBe('on');
  });

  it('gives way to the account default when it is changed on the account page during the visit', () => {
    const setting = create();
    signIn({ heroVideo: false, sound: true });
    setting.set('off');

    signIn({ heroVideo: false, sound: false });
    expect(setting.value()).toBe('off');

    signIn({ heroVideo: false, sound: true });
    expect(setting.value()).toBe('on');
  });

  it('keeps this visit\'s choice when the account is saved with the same value', () => {
    const setting = create();
    signIn({ heroVideo: false, sound: true });
    setting.set('off');

    signIn({ heroVideo: true, sound: true });

    expect(setting.value()).toBe('off');
  });

  it('is the browser-remembered choice when the account\'s defaults could not be read', () => {
    const setting = create();
    browser.set('on');

    signIn(null);

    expect(setting.value()).toBe('on');

    setting.set('off');

    expect(browser.saved).toHaveBeenCalledWith('off');
  });

  it('is the browser-remembered choice again after signing out', () => {
    const setting = create();
    signIn({ heroVideo: false, sound: true });
    auth.state.set({ status: 'signedOut' });

    expect(setting.value()).toBe('off');
  });
});
