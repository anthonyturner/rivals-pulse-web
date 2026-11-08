import { Injectable } from '@angular/core';

import { rememberedSetting } from '../../../shared/utilities/remembered-setting';

export type HeroPosterBackdrop = 'portrait' | 'video';

const STORAGE_KEY = 'rp.hero-poster-backdrop';

/** The visitor's chosen poster backdrop, remembered in this browser; the server renders the portrait. */
@Injectable({ providedIn: 'root' })
export class HeroPosterBackdropPreferenceService {
  private readonly choice = rememberedSetting<HeroPosterBackdrop>({
    key: STORAGE_KEY,
    fallback: 'portrait',
    isValid: (saved): saved is HeroPosterBackdrop => saved === 'portrait' || saved === 'video',
  });

  readonly backdrop = this.choice.value;

  set(backdrop: HeroPosterBackdrop): void {
    this.choice.set(backdrop);
  }
}
