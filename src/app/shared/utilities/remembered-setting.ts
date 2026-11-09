import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Signal, afterNextRender, inject, signal } from '@angular/core';

export interface RememberedSettingOptions<T extends string> {
  /** The localStorage key. */
  readonly key: string;
  /** Used on the server, on a first visit, and when the saved text is not a valid value or cannot be read. */
  readonly fallback: T;
  readonly isValid: (saved: string) => saved is T;
}

export interface RememberedSetting<T extends string> {
  readonly value: Signal<T>;
  set(value: T): void;
}

/**
 * A choice remembered in this browser. It starts on the fallback and reads the saved value after the
 * first render, because the server always renders the fallback and hydration must see the same
 * markup. Blocked storage (private windows, cookie settings) throws; the choice then lasts for this
 * visit only. Call it from an injection context.
 */
export function rememberedSetting<T extends string>({ key, fallback, isValid }: RememberedSettingOptions<T>): RememberedSetting<T> {
  const document = inject(DOCUMENT);
  const storage = (): Storage | undefined => document.defaultView?.localStorage;
  const current = signal<T>(fallback);

  const read = (): T => {
    try {
      const saved = storage()?.getItem(key);

      return saved != null && isValid(saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  };

  if (isPlatformBrowser(inject(PLATFORM_ID))) {
    afterNextRender(() => current.set(read()));
  }

  return {
    value: current.asReadonly(),
    set(value: T): void {
      current.set(value);

      try {
        storage()?.setItem(key, value);
      } catch {
        // Not saved; see above.
      }
    },
  };
}
