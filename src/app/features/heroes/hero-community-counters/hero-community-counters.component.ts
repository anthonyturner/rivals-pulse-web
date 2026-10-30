import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import type { RosterHero } from '../../insights/hero-matchup-records';
import { buildHeroCommunityCountersView } from './hero-community-counters-view';

/** How one hero fares against others in matches recorded by Rivals Pulse players, or why there is nothing to show yet. */
@Component({
  selector: 'app-hero-community-counters',
  imports: [RouterLink],
  templateUrl: './hero-community-counters.component.html',
  styleUrl: './hero-community-counters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroCommunityCountersComponent {
  readonly heroId = input.required<string>();
  readonly heroName = input.required<string>();
  /** `undefined` while loading, `null` when the matchups could not be read. */
  readonly matchups = input<HeroMatchups | null | undefined>(undefined);
  readonly roster = input<readonly RosterHero[]>([]);

  protected readonly view = computed(() =>
    buildHeroCommunityCountersView(this.matchups(), this.heroId(), this.heroName(), this.roster()),
  );
}
