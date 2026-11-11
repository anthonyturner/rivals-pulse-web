import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { heartbeatRate } from '../../../core/circuit/heartbeat-line';
import { recentMatchesPerDay } from '../../community/matches-tab/community-matches-view';
import { CommunityMatchesService } from '../../community/matches-tab/community-matches.service';
import { InsightsTabComponent } from '../../community/insights-tab/insights-tab.component';
import { MatchesTabComponent } from '../../community/matches-tab/matches-tab.component';
import { GameStatsComponent } from '../../insights/game-stats/game-stats.component';

/** Where the numbers come from and where a visitor's own figures are, which the overview's sections do not say. */
const OVERVIEW_LINKS = [
  { label: 'How we count', path: '/how-we-count' },
  { label: 'Privacy notes', path: '/privacy' },
  { label: 'Your Profile', path: '/profile' },
] as const;

/**
 * The hub's front page, a compact summary: how much has been counted, then what the counted matches say
 * about maps, modes, length and when players win. The matches answer is the one the matches section
 * reads too, so the heartbeat behind the headline figures can beat at the pace of the recent uploads
 * without a request of its own.
 */
@Component({
  selector: 'app-stats-overview',
  imports: [GameStatsComponent, InsightsTabComponent, MatchesTabComponent, RouterLink],
  templateUrl: './stats-overview.component.html',
  styleUrls: ['../../../shared/styles/pill-link.css', './stats-overview.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsOverviewComponent {
  private readonly matches = toSignal(inject(CommunityMatchesService).getMatches());

  protected readonly links = OVERVIEW_LINKS;
  protected readonly beatRate = computed(() => {
    const matches = this.matches();

    return heartbeatRate(matches?.status === 'ready' ? recentMatchesPerDay(matches) : null);
  });
}
