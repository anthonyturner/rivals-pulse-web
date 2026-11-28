import { Injectable, computed } from '@angular/core';

import { accountDefaultedSetting } from '../../core/auth/account-defaulted-setting';
import { rememberedSetting } from '../../shared/utilities/remembered-setting';

export const PULSE_SOUND_STORAGE_KEY = 'rp.home-pulse-sound';

type PulseSoundChoice = 'on' | 'off';

/**
 * Whether the home hero's pulse banner makes sound. A signed-in visitor gets their account's sound
 * default, and the banner's toggle changes it for this visit only; anyone else gets the choice
 * remembered in this browser. It starts off, on the server and on a first visit, because browsers block
 * audio until the visitor interacts with the page.
 */
@Injectable({ providedIn: 'root' })
export class PulseSoundPreferenceService {
  private readonly choice = accountDefaultedSetting(
    rememberedSetting<PulseSoundChoice>({
      key: PULSE_SOUND_STORAGE_KEY,
      fallback: 'off',
      isValid: (saved): saved is PulseSoundChoice => saved === 'on' || saved === 'off',
    }),
    ({ sound }) => (sound ? 'on' : 'off'),
  );

  readonly enabled = computed(() => this.choice.value() === 'on');

  set(enabled: boolean): void {
    this.choice.set(enabled ? 'on' : 'off');
  }
}
