import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { HeroDataService } from '../../heroes/hero-data.service';
import { CurrentHeroStatsService } from '../../insights/current-hero-stats.service';
import { heroIdentities } from '../../insights/hero-identity';
import { TierRowsComponent } from '../../insights/tier-rows/tier-rows.component';
import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { buildTierListTabView } from './tier-list-tab-view';

/** The S and A tiers of the community tier list, or the reason there is no list yet. */
@Component({
  selector: 'app-community-tier-list-tab',
  imports: [CommunitySummaryComponent, TierRowsComponent],
  templateUrl: './tier-list-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierListTabComponent {
  // undefined while the request runs, null once it has failed.
  private readonly stats = toSignal(inject(CurrentHeroStatsService).getHeroStats());
  private readonly roster = toSignal(inject(HeroDataService).getHeroes());

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  protected readonly view = computed(() => {
    const roster = this.roster();

    return buildTierListTabView(roster === undefined ? undefined : this.stats(), heroIdentities(roster ?? []));
  });

  protected readonly link = { label: 'See the full tier list', path: '/tier-list' };
}
