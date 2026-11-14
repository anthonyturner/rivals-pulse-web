import { Injectable, computed } from '@angular/core';

import { rememberedSetting } from '../../shared/utilities/remembered-setting';

export const HOME_HERO_VIDEO_STORAGE_KEY = 'rp.home-hero-video';

type HeroVideoChoice = 'on' | 'off';

/**
 * Whether the home hero plays its background video, remembered in this browser. It starts off, on the
 * server and on a first visit, so no video is downloaded until the visitor turns it on.
 */
@Injectable({ providedIn: 'root' })
export class HomeHeroVideoPreferenceService {
  private readonly choice = rememberedSetting<HeroVideoChoice>({
    key: HOME_HERO_VIDEO_STORAGE_KEY,
    fallback: 'off',
    isValid: (saved): saved is HeroVideoChoice => saved === 'on' || saved === 'off',
  });

  readonly enabled = computed(() => this.choice.value() === 'on');

  set(enabled: boolean): void {
    this.choice.set(enabled ? 'on' : 'off');
  }
}
