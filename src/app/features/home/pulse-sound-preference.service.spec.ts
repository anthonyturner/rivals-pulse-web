import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../core/auth/auth.service';
import { PULSE_SOUND_STORAGE_KEY, PulseSoundPreferenceService } from './pulse-sound-preference.service';

describe('PulseSoundPreferenceService', () => {
  beforeEach(() => {
    localStorage.removeItem(PULSE_SOUND_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => localStorage.removeItem(PULSE_SOUND_STORAGE_KEY));

  async function firstRender(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('keeps the sound off on a first visit', async () => {
    const preference = TestBed.inject(PulseSoundPreferenceService);

    expect(preference.enabled()).toBeFalse();

    await firstRender();

    expect(preference.enabled()).toBeFalse();
  });

  it('restores a saved "on" after the first render', async () => {
    localStorage.setItem(PULSE_SOUND_STORAGE_KEY, 'on');
    const preference = TestBed.inject(PulseSoundPreferenceService);

    expect(preference.enabled()).toBeFalse();

    await firstRender();

    expect(preference.enabled()).toBeTrue();
  });

  it('keeps a saved "off" off', async () => {
    localStorage.setItem(PULSE_SOUND_STORAGE_KEY, 'off');
    const preference = TestBed.inject(PulseSoundPreferenceService);
    await firstRender();

    expect(preference.enabled()).toBeFalse();
  });

  it('falls back to off when the saved text is not a choice', async () => {
    localStorage.setItem(PULSE_SOUND_STORAGE_KEY, 'maybe');
    const preference = TestBed.inject(PulseSoundPreferenceService);
    await firstRender();

    expect(preference.enabled()).toBeFalse();
  });

  it('falls back to off when storage is blocked', async () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    const preference = TestBed.inject(PulseSoundPreferenceService);
    await firstRender();

    expect(preference.enabled()).toBeFalse();
  });

  it('saves "off" and "on" as the choice changes', () => {
    const preference = TestBed.inject(PulseSoundPreferenceService);

    preference.set(false);
    expect(preference.enabled()).toBeFalse();
    expect(localStorage.getItem(PULSE_SOUND_STORAGE_KEY)).toBe('off');

    preference.set(true);
    expect(preference.enabled()).toBeTrue();
    expect(localStorage.getItem(PULSE_SOUND_STORAGE_KEY)).toBe('on');
  });
});

describe('PulseSoundPreferenceService for a signed-in visitor', () => {
  const ACCOUNT = { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' };

  beforeEach(() => {
    localStorage.removeItem(PULSE_SOUND_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => localStorage.removeItem(PULSE_SOUND_STORAGE_KEY));

  const signIn = (sound: boolean): void =>
    TestBed.inject(AuthService).state.set({
      status: 'signedIn',
      account: ACCOUNT,
      player: null,
      isAdmin: false,
      mediaDefaults: { heroVideo: false, sound },
    });

  it('follows the account sound default', () => {
    const preference = TestBed.inject(PulseSoundPreferenceService);

    signIn(true);

    expect(preference.enabled()).toBeTrue();

    signIn(false);

    expect(preference.enabled()).toBeFalse();
  });

  it('beats what this browser remembered', async () => {
    localStorage.setItem(PULSE_SOUND_STORAGE_KEY, 'on');
    const preference = TestBed.inject(PulseSoundPreferenceService);
    signIn(false);
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();

    expect(preference.enabled()).toBeFalse();
  });

  it('changes for this visit only: the toggle saves nothing, and the account default returns next visit', () => {
    signIn(true);
    TestBed.inject(PulseSoundPreferenceService).set(false);

    expect(TestBed.inject(PulseSoundPreferenceService).enabled()).toBeFalse();
    expect(localStorage.getItem(PULSE_SOUND_STORAGE_KEY)).toBeNull();
    expect(TestBed.inject(AuthService).mediaDefaults()).toEqual({ heroVideo: false, sound: true });

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    signIn(true);

    expect(TestBed.inject(PulseSoundPreferenceService).enabled()).toBeTrue();
  });

  it('is the browser-remembered choice once the visitor signs out', () => {
    const preference = TestBed.inject(PulseSoundPreferenceService);
    signIn(true);
    TestBed.inject(AuthService).state.set({ status: 'signedOut' });

    expect(preference.enabled()).toBeFalse();

    preference.set(true);

    expect(localStorage.getItem(PULSE_SOUND_STORAGE_KEY)).toBe('on');
  });
});
