import { ChangeDetectionStrategy, Component } from '@angular/core';

import { InsightsTabComponent } from '../../community/insights-tab/insights-tab.component';
import { MatchesTabComponent } from '../../community/matches-tab/matches-tab.component';
import { GameStatsComponent } from '../../insights/game-stats/game-stats.component';

/** The hub's front page: how much has been counted, then what the counted matches say about modes, length and when players win. */
@Component({
  selector: 'app-stats-overview',
  imports: [GameStatsComponent, InsightsTabComponent, MatchesTabComponent],
  templateUrl: './stats-overview.component.html',
  styleUrl: './stats-overview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsOverviewComponent {}
