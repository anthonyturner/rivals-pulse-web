import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { afterNextRender, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export const HOME_HERO_VIDEO_STORAGE_KEY = 'rp.home-hero-video';

/** Whether the home hero plays its background video, remembered in this browser. */
@Injectable({ providedIn: 'root' })
export class HomeHeroVideoPreferenceService {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal(true);

  readonly enabled = this.current.asReadonly();

  constructor() {
    // Read after the first render: the server always renders the video, and hydration must see the same markup.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.current.set(this.readSaved()));
    }
  }

  set(enabled: boolean): void {
    this.current.set(enabled);

    try {
      this.document.defaultView?.localStorage.setItem(HOME_HERO_VIDEO_STORAGE_KEY, enabled ? 'on' : 'off');
    } catch {
      // Private windows and blocked storage throw; the choice then lasts for this visit only.
    }
  }

  private readSaved(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(HOME_HERO_VIDEO_STORAGE_KEY) !== 'off';
    } catch {
      return true;
    }
  }
}
