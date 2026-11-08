import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { HeroSwitchIns } from '../../../../contracts/hero-switch-ins.model';
import type { RosterHero } from '../../insights/hero-matchup-records';
import { buildHeroSwitchInsView } from './hero-switch-ins-view';

/** How often a team wins after a player switches to this hero, or against it, or why there is nothing to show yet. */
@Component({
  selector: 'app-hero-switch-ins',
  templateUrl: './hero-switch-ins.component.html',
  styleUrl: './hero-switch-ins.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSwitchInsComponent {
  readonly heroId = input.required<string>();
  readonly heroName = input.required<string>();
  /** `undefined` while loading, `null` when the switch-ins could not be read. */
  readonly switchIns = input<HeroSwitchIns | null | undefined>(undefined);
  readonly roster = input<readonly RosterHero[]>([]);

  protected readonly view = computed(() => buildHeroSwitchInsView(this.switchIns(), this.heroId(), this.roster()));
}
