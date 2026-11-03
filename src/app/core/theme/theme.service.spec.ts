import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { THEME_STORAGE_KEY, Theme, ThemeService } from './theme.service';

interface Setup {
  saved?: string;
  prefersLight?: boolean;
  storageBlocked?: boolean;
  platform?: 'browser' | 'server';
}

describe('ThemeService', () => {
  let root: HTMLElement;
  let store: Map<string, string>;

  /** A stand-in document, so a test neither reads the real storage nor leaves a theme on the real page. */
  function create({ saved, prefersLight = false, storageBlocked = false, platform = 'browser' }: Setup = {}): ThemeService {
    root = document.createElement('html');
    store = new Map(saved === undefined ? [] : [[THEME_STORAGE_KEY, saved]]);

    const view = {
      get localStorage(): Pick<Storage, 'getItem' | 'setItem'> {
        if (storageBlocked) {
          throw new DOMException('blocked', 'SecurityError');
        }

        return { getItem: (key) => store.get(key) ?? null, setItem: (key, value) => void store.set(key, value) };
      },
      matchMedia: (query: string) => ({ matches: prefersLight && query === '(prefers-color-scheme: light)' }),
    };

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: DOCUMENT, useValue: { documentElement: root, defaultView: view } },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });

    return TestBed.inject(ThemeService);
  }

  const applied = (): string | null => root.getAttribute('data-theme');

  it('uses the saved choice and puts it on the page', () => {
    const service = create({ saved: 'light' });

    expect(service.theme()).toBe('light');
    expect(applied()).toBe('light');
  });

  it('prefers a saved choice to the device setting', () => {
    expect(create({ saved: 'dark', prefersLight: true }).theme()).toBe('dark');
  });

  it('follows the device when nothing is saved, and falls back to dark', () => {
    expect(create({ prefersLight: true }).theme()).toBe('light');

    TestBed.resetTestingModule();

    expect(create({ prefersLight: false }).theme()).toBe('dark');
  });

  it('ignores a saved value that is not a theme', () => {
    expect(create({ saved: 'purple' }).theme()).toBe('dark');
  });

  it('still works when storage is blocked', () => {
    const service = create({ storageBlocked: true, prefersLight: true });

    expect(service.theme()).toBe('light');

    service.setTheme('dark');

    expect(service.theme()).toBe('dark');
    expect(applied()).toBe('dark');
  });

  it('toggles between the two themes, applies each and saves the choice', () => {
    const service = create();
    const seen: Theme[] = [];

    service.toggleTheme();
    seen.push(service.theme());
    expect(applied()).toBe('light');
    expect(store.get(THEME_STORAGE_KEY)).toBe('light');

    service.toggleTheme();
    seen.push(service.theme());
    expect(applied()).toBe('dark');
    expect(store.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(seen).toEqual(['light', 'dark']);
  });

  it('renders dark on the server and leaves the page and storage alone', () => {
    const service = create({ saved: 'light', platform: 'server' });

    expect(service.theme()).toBe('dark');
    expect(applied()).toBeNull();

    service.setTheme('light');

    expect(applied()).toBeNull();
    expect(store.get(THEME_STORAGE_KEY)).toBe('light');
  });
});
