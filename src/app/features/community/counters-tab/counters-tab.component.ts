import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { HeroDataService } from '../../heroes/hero-data.service';
import { CommunityKillsService } from '../../insights/community-kills.service';
import { KILL_FEED_CAVEAT } from '../../insights/hero-kill-feed';
import { CurrentHeroMatchupsService } from '../../insights/current-hero-matchups.service';
import { heroIdentities } from '../../insights/hero-identity';
import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { buildCountersTabView } from './counters-tab-view';
import { buildCountersKillFeedView } from './kill-feed-view';

/** The counters with the clearest edge, from RivalsPulse uploads, or the reason there are none yet. */
@Component({
  selector: 'app-community-counters-tab',
  imports: [CommunitySummaryComponent],
  templateUrl: './counters-tab.component.html',
  styleUrl: './counters-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountersTabComponent {
  // undefined while the request runs, null once it has failed.
  private readonly matchups = toSignal(inject(CurrentHeroMatchupsService).getHeroMatchups());
  private readonly kills = toSignal(inject(CommunityKillsService).getKills());
  private readonly roster = toSignal(inject(HeroDataService).getHeroes());

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  protected readonly view = computed(() => {
    const roster = this.roster();

    return buildCountersTabView(roster === undefined ? undefined : this.matchups(), heroIdentities(roster ?? []));
  });

  protected readonly killFeedView = computed(() => {
    const roster = this.roster();

    return buildCountersKillFeedView(roster === undefined ? undefined : this.kills(), heroIdentities(roster ?? []));
  });

  protected readonly killFeedFootnote = `A separate measure from the matchup records above. ${KILL_FEED_CAVEAT} Each hero's own best pairs are on its page under Heroes.`;
  protected readonly link = { label: 'Open the counters tool', path: '/counters' };

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }
}
