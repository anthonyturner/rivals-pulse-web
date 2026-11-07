import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

/** The inline script in `index.html` reads the same key, so the two must change together. */
export const THEME_STORAGE_KEY = 'rp.web-theme';

const isTheme = (value: unknown): value is Theme => value === 'dark' || value === 'light';

/**
 * Owns the light/dark choice and puts it on `<html data-theme>`, where the palette in `styles.css`
 * picks it up. A saved choice wins; with none the device's colour scheme decides, and dark is the
 * fallback. The server cannot know the visitor's choice, so it renders dark and the inline script in
 * `index.html` has already set the real theme before the browser paints.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly current = signal<Theme>(this.browser ? this.resolve() : 'dark');

  readonly theme = this.current.asReadonly();

  constructor() {
    if (this.browser) {
      this.apply(this.current());
    }
  }

  toggleTheme(): void {
    this.setTheme(this.current() === 'dark' ? 'light' : 'dark');
  }

  setTheme(theme: Theme): void {
    this.current.set(theme);

    if (this.browser) {
      this.apply(theme);
      this.save(theme);
    }
  }

  private apply(theme: Theme): void {
    this.document.documentElement.setAttribute('data-theme', theme);
  }

  private resolve(): Theme {
    const saved = this.readSaved();

    if (saved) {
      return saved;
    }

    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  /** Storage can be blocked (private mode, cookie settings): the theme still applies for this visit. */
  private readSaved(): Theme | null {
    try {
      const saved = this.document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);

      return isTheme(saved) ? saved : null;
    } catch {
      return null;
    }
  }

  private save(theme: Theme): void {
    try {
      this.document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Not saved; see readSaved.
    }
  }
}
