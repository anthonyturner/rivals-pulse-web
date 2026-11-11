import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import type { TileChip } from '../../hub/hub-tile.types';
import { HubTileComponent } from '../../hub/hub-tile/hub-tile.component';
import { KindChipComponent } from '../../hub/kind-chip/kind-chip.component';
import { contentState, reportContentState } from '../../../core/seo/thin-content';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { buildGameStatsView } from './game-stats-view';
import { GameStatsService } from './game-stats.service';

/** The matches and players RivalsPulse has counted, with no page around it: the Stats overview draws it. */
@Component({
  selector: 'app-game-stats',
  imports: [HubTileComponent, KindChipComponent, StatePanelComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './game-stats.component.html',
  styleUrls: ['../insight-page.css', './game-stats.component.css'],
})
export class GameStatsComponent {
  // undefined while the request runs, null once it has failed.
  private readonly counts = toSignal(inject(GameStatsService).getGameCounts());

  readonly view = computed(() => buildGameStatsView(this.counts()));
  /** The line above the counts, once there are counts to describe. */
  readonly meta = computed(() => {
    const view = this.view();

    return view.status === 'ready' ? view.meta : null;
  });
  readonly leadImage = '/images/site/banners/game-stats-banner.webp';
  readonly leadChip: TileChip = { kind: 'secondary', label: 'From the app' };

  constructor() {
    reportContentState(() => contentState(this.view().status === 'loading', this.view().status === 'ready'));
  }
}
