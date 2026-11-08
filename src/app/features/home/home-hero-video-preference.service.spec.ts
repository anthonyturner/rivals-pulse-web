import { DOCUMENT } from '@angular/common';
import { ApplicationRef, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HOME_HERO_VIDEO_STORAGE_KEY, HomeHeroVideoPreferenceService } from './home-hero-video-preference.service';

interface Setup {
  saved?: string;
  storageBlocked?: boolean;
  platform?: 'browser' | 'server';
}

describe('HomeHeroVideoPreferenceService', () => {
  let store: Map<string, string>;

  /** A stand-in document, so a test neither reads the real storage nor leaves a choice behind. */
  function create({ saved, storageBlocked = false, platform = 'browser' }: Setup = {}): HomeHeroVideoPreferenceService {
    store = new Map(saved === undefined ? [] : [[HOME_HERO_VIDEO_STORAGE_KEY, saved]]);

    const view = {
      get localStorage(): Pick<Storage, 'getItem' | 'setItem'> {
        if (storageBlocked) {
          throw new DOMException('blocked', 'SecurityError');
        }

        return { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => void store.set(key, value) };
      },
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DOCUMENT, useValue: { defaultView: view } },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });

    return TestBed.inject(HomeHeroVideoPreferenceService);
  }

  /** The saved choice is read after the first render. */
  async function firstRender(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('plays the video on a first visit', async () => {
    const preference = create();
    await firstRender();

    expect(preference.enabled()).toBeTrue();
  });

  it('plays the video until the first render has read the saved choice, so hydration matches the server', async () => {
    const preference = create({ saved: 'off' });

    expect(preference.enabled()).toBeTrue();

    await firstRender();

    expect(preference.enabled()).toBeFalse();
  });

  it('keeps a saved "on" and treats anything unrecognised as on', async () => {
    for (const saved of ['on', 'maybe', '']) {
      TestBed.resetTestingModule();
      const preference = create({ saved });
      await firstRender();

      expect(preference.enabled()).withContext(`saved "${saved}"`).toBeTrue();
    }
  });

  it('saves each choice for the next visit', () => {
    const preference = create();

    preference.set(false);
    expect(preference.enabled()).toBeFalse();
    expect(store.get(HOME_HERO_VIDEO_STORAGE_KEY)).toBe('off');

    preference.set(true);
    expect(preference.enabled()).toBeTrue();
    expect(store.get(HOME_HERO_VIDEO_STORAGE_KEY)).toBe('on');
  });

  it('keeps the choice for this visit when storage is blocked, and plays the video when it cannot be read', async () => {
    const preference = create({ storageBlocked: true });
    await firstRender();

    expect(preference.enabled()).toBeTrue();

    expect(() => preference.set(false)).not.toThrow();
    expect(preference.enabled()).toBeFalse();
  });

  it('never touches storage on the server', async () => {
    const preference = create({ saved: 'off', platform: 'server' });
    await firstRender();

    expect(preference.enabled()).toBeTrue();
  });
});
