import { Injectable, computed } from '@angular/core';

import { rememberedSetting } from '../../shared/utilities/remembered-setting';

export const PULSE_SOUND_STORAGE_KEY = 'rp.home-pulse-sound';

type PulseSoundChoice = 'on' | 'off';

/**
 * Whether the home hero's pulse banner makes sound, remembered in this browser. It starts off, on the
 * server and on a first visit, because browsers block audio until the visitor interacts with the page.
 */
@Injectable({ providedIn: 'root' })
export class PulseSoundPreferenceService {
  private readonly choice = rememberedSetting<PulseSoundChoice>({
    key: PULSE_SOUND_STORAGE_KEY,
    fallback: 'off',
    isValid: (saved): saved is PulseSoundChoice => saved === 'on' || saved === 'off',
  });

  readonly enabled = computed(() => this.choice.value() === 'on');

  set(enabled: boolean): void {
    this.choice.set(enabled ? 'on' : 'off');
  }
}
