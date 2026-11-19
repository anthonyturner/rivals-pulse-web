import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { CommunityKills } from '../../../../contracts/community-kills.model';
import { KILL_FEED_CAVEAT } from '../../insights/hero-kill-feed';
import type { RosterHero } from '../../insights/hero-matchup-records';
import { buildHeroKillFeedView } from './hero-kill-feed-view';

/** Whom one hero is seen killing most, and who is seen killing it most, or why there is nothing to show yet. */
@Component({
  selector: 'app-hero-kill-feed',
  templateUrl: './hero-kill-feed.component.html',
  styleUrl: './hero-kill-feed.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroKillFeedComponent {
  readonly heroId = input.required<string>();
  readonly heroName = input.required<string>();
  /** `undefined` while loading, `null` when the kill-feed counters could not be read. */
  readonly kills = input<CommunityKills | null | undefined>(undefined);
  readonly roster = input<readonly RosterHero[]>([]);

  protected readonly caveat = KILL_FEED_CAVEAT;
  protected readonly view = computed(() =>
    buildHeroKillFeedView(this.kills(), this.heroId(), this.heroName(), this.roster()),
  );
}
