import { Injectable, inject } from '@angular/core';

import { accountDefaultedSetting } from '../../../core/auth/account-defaulted-setting';
import { ReducedMotionService } from '../../../core/accessibility/reduced-motion.service';
import { rememberedSetting } from '../../../shared/utilities/remembered-setting';

export type HeroPosterBackdrop = 'portrait' | 'video';

const STORAGE_KEY = 'rp.hero-poster-backdrop';

/**
 * The poster backdrop a hero page opens with. A signed-in visitor gets their account's default, and
 * switching it lasts for this visit; anyone else gets the choice remembered in this browser. The server
 * renders the portrait either way, because it cannot know who is asking.
 */
@Injectable({ providedIn: 'root' })
export class HeroPosterBackdropPreferenceService {
  private readonly reducedMotion = inject(ReducedMotionService).reduced;

  private readonly choice = accountDefaultedSetting(
    rememberedSetting<HeroPosterBackdrop>({
      key: STORAGE_KEY,
      fallback: 'portrait',
      isValid: (saved): saved is HeroPosterBackdrop => saved === 'portrait' || saved === 'video',
    }),
    // A saved default never starts motion on its own for a visitor who asked for less; they can still press the switch.
    ({ heroVideo }) => (heroVideo && !this.reducedMotion() ? 'video' : 'portrait'),
  );

  readonly backdrop = this.choice.value;

  set(backdrop: HeroPosterBackdrop): void {
    this.choice.set(backdrop);
  }
}
