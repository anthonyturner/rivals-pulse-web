import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { RESTING_BEATS_PER_MINUTE } from '../../../core/circuit/heartbeat-line';
import { contentState, reportContentState } from '../../../core/seo/thin-content';
import { ColumnChartComponent } from '../../../shared/components/chart/column-chart/column-chart.component';
import { HeartbeatLineComponent } from '../../../shared/components/heartbeat-line/heartbeat-line.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { HeroDataService } from '../../heroes/hero-data.service';
import { CurrentHeroStatsService } from '../current-hero-stats.service';
import { heroIdentities } from '../hero-identity';
import { buildGameStatsView, HALF_SEASON_LANES } from './game-stats-view';
import { GameStatsService } from './game-stats.service';
import { HeroSpotlightComponent } from './hero-spotlight/hero-spotlight.component';
import { buildHeroSpotlightsView } from './hero-spotlights-view';

/**
 * The matches and players RivalsPulse has counted, with no page around it: the Stats overview opens with
 * it. The headline figures sit over a heartbeat line, which beats at `beatRate`, beside the hero picked
 * most and the hero that wins most. A chart of matches and players per half-season follows.
 */
@Component({
  selector: 'app-game-stats',
  imports: [ColumnChartComponent, HeartbeatLineComponent, HeroSpotlightComponent, StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-stats.component.html',
  styleUrls: ['../../../shared/styles/stat-panels.css', './game-stats.component.css'],
})
export class GameStatsComponent {
  /** Beats per minute for the heartbeat behind the figures. */
  readonly beatRate = input(RESTING_BEATS_PER_MINUTE);

  // undefined while the request runs, null once it has failed.
  private readonly counts = toSignal(inject(GameStatsService).getGameCounts());

  readonly view = computed(() => buildGameStatsView(this.counts()));

  // undefined while the request runs, null once it has failed.
  private readonly heroStats = toSignal(inject(CurrentHeroStatsService).getHeroStats());
  private readonly roster = toSignal(inject(HeroDataService).getHeroes());

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  protected readonly spotlights = computed(() => {
    const roster = this.roster();

    return buildHeroSpotlightsView(roster === undefined ? undefined : this.heroStats(), heroIdentities(roster ?? []));
  });

  protected readonly seasonLanes = HALF_SEASON_LANES;

  constructor() {
    reportContentState(() => contentState(this.view().status === 'loading', this.view().status === 'ready'));
  }
}
