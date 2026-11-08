import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { afterNextRender, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type HeroPosterBackdrop = 'portrait' | 'video';

const STORAGE_KEY = 'rp.hero-poster-backdrop';

/** The visitor's chosen poster backdrop, remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class HeroPosterBackdropPreferenceService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<HeroPosterBackdrop>('portrait');

  readonly backdrop = this.current.asReadonly();

  constructor() {
    // Read after the first render: the server always renders the portrait, and hydration must see the same markup.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.current.set(this.readSaved()));
    }
  }

  set(backdrop: HeroPosterBackdrop): void {
    this.current.set(backdrop);

    try {
      this.document.defaultView?.localStorage.setItem(STORAGE_KEY, backdrop);
    } catch {
      // Private windows and blocked storage throw; the choice then lasts for this visit only.
    }
  }

  private readSaved(): HeroPosterBackdrop {
    try {
      return this.document.defaultView?.localStorage.getItem(STORAGE_KEY) === 'video' ? 'video' : 'portrait';
    } catch {
      return 'portrait';
    }
  }
}
