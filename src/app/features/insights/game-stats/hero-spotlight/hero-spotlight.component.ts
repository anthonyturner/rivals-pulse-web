import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroImageFallbackDirective } from '../../../../shared/directives/hero-image-fallback.directive';
import type { CommunityHeroRow } from '../../../community/community-hero-list/community-hero-list.component';
import { HeroRoleChipComponent } from '../../hero-role-chip/hero-role-chip.component';

/**
 * One hero set large: its portrait, the figure that put it here and what that figure rests on. The
 * whole tile opens the hero page. With no hero it draws an empty tile of the same size, so the page
 * does not jump when the hero numbers arrive.
 */
@Component({
  selector: 'app-hero-spotlight',
  imports: [HeroImageFallbackDirective, HeroRoleChipComponent, RouterLink],
  templateUrl: './hero-spotlight.component.html',
  styleUrl: './hero-spotlight.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSpotlightComponent {
  /** What the hero leads, such as "Most picked". */
  readonly heading = input('');
  /** Null while the hero numbers are still on their way. */
  readonly hero = input<CommunityHeroRow | null>(null);
  /** Names the figure, such as "pick rate", for the words beside it. */
  readonly figureLabel = input('');

  /** The role as a style key, or null when the hero has no role, so nothing is tinted by a guess. */
  protected readonly roleKey = computed(() => this.hero()?.role?.trim().toLowerCase() || null);
}
