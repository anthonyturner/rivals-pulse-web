import { DOCUMENT } from '@angular/common';
import { ApplicationRef, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { RememberedSetting, rememberedSetting } from './remembered-setting';

type Size = 'small' | 'large';

interface Setup {
  saved?: string;
  storageBlocked?: boolean;
  platform?: 'browser' | 'server';
}

describe('rememberedSetting', () => {
  const KEY = 'test.size';
  let store: Map<string, string>;

  /** A stand-in document, so a test neither reads the real storage nor leaves a choice behind. */
  function create({ saved, storageBlocked = false, platform = 'browser' }: Setup = {}): RememberedSetting<Size> {
    store = new Map(saved === undefined ? [] : [[KEY, saved]]);

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

    return TestBed.runInInjectionContext(() =>
      rememberedSetting<Size>({
        key: KEY,
        fallback: 'small',
        isValid: (text): text is Size => text === 'small' || text === 'large',
      }),
    );
  }

  /** The saved choice is read after the first render. */
  async function firstRender(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('uses the fallback on a first visit', async () => {
    const setting = create();
    await firstRender();

    expect(setting.value()).toBe('small');
  });

  it('keeps the fallback until the first render has read the saved value, so hydration matches the server', async () => {
    const setting = create({ saved: 'large' });

    expect(setting.value()).toBe('small');

    await firstRender();

    expect(setting.value()).toBe('large');
  });

  it('uses the fallback for a saved value that is not valid', async () => {
    for (const saved of ['huge', '', 'LARGE']) {
      TestBed.resetTestingModule();
      const setting = create({ saved });
      await firstRender();

      expect(setting.value()).withContext(`saved "${saved}"`).toBe('small');
    }
  });

  it('saves each choice for the next visit', () => {
    const setting = create();

    setting.set('large');
    expect(setting.value()).toBe('large');
    expect(store.get(KEY)).toBe('large');

    setting.set('small');
    expect(store.get(KEY)).toBe('small');
  });

  it('keeps the choice for this visit when storage is blocked, and uses the fallback when it cannot be read', async () => {
    const setting = create({ storageBlocked: true });
    await firstRender();

    expect(setting.value()).toBe('small');
    expect(() => setting.set('large')).not.toThrow();
    expect(setting.value()).toBe('large');
  });

  it('never touches storage on the server', async () => {
    const setting = create({ saved: 'large', platform: 'server' });
    await firstRender();

    expect(setting.value()).toBe('small');
  });
});
