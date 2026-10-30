import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { buildHeroCommunityStatsView } from './hero-community-stats-view';

/** One hero's numbers from Rivals Pulse overlay matches, or the reason there are none to show yet. */
@Component({
  selector: 'app-hero-community-stats',
  templateUrl: './hero-community-stats.component.html',
  styleUrl: './hero-community-stats.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroCommunityStatsComponent {
  readonly heroId = input.required<string>();
  readonly heroName = input.required<string>();
  /** `undefined` while loading, `null` when the stats could not be read. */
  readonly stats = input<HeroStats | null | undefined>(undefined);

  protected readonly view = computed(() => buildHeroCommunityStatsView(this.stats(), this.heroId()));
}
