import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HeroProgressListComponent } from '../../../insights/hero-progress-list/hero-progress-list.component';
import { StatePanelComponent } from '../../../../shared/components/state-panel/state-panel.component';
import { TierRowsComponent } from './tier-rows/tier-rows.component';
import type { TierListView } from './tier-list-view';

/** The community tier list: heroes grouped by tier, and the heroes still short of a placement. */
@Component({
  selector: 'app-hero-tiers',
  imports: [HeroProgressListComponent, StatePanelComponent, TierRowsComponent],
  templateUrl: './hero-tiers.component.html',
  styleUrl: './hero-tiers.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroTiersComponent {
  readonly view = input.required<TierListView>();
}
