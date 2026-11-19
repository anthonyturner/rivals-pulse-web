import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { RESTING_BEATS_PER_MINUTE } from '../../../core/circuit/heartbeat-line';
import { contentState, reportContentState } from '../../../core/seo/thin-content';
import { HeartbeatLineComponent } from '../../../shared/components/heartbeat-line/heartbeat-line.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { buildGameStatsView } from './game-stats-view';
import { GameStatsService } from './game-stats.service';

/**
 * The matches and players RivalsPulse has counted, with no page around it: the Stats overview opens with
 * it. The headline figures sit over a heartbeat line, which beats at `beatRate`.
 */
@Component({
  selector: 'app-game-stats',
  imports: [HeartbeatLineComponent, StatePanelComponent],
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

  constructor() {
    reportContentState(() => contentState(this.view().status === 'loading', this.view().status === 'ready'));
  }
}
