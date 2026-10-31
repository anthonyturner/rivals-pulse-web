import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';
import { CommunityInsightsService } from './community-insights.service';
import { buildInsightsTabView } from './insights-tab-view';

/** When the community plays and wins, or the designed "not enough data yet" state. */
@Component({
  selector: 'app-community-insights-tab',
  imports: [CommunityEmptyStateComponent],
  templateUrl: './insights-tab.component.html',
  styleUrl: './insights-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsTabComponent {
  /** `undefined` while loading, `null` when the answer could not be read. */
  private readonly insights = toSignal(inject(CommunityInsightsService).getInsights());

  protected readonly view = computed(() => buildInsightsTabView(this.insights()));
}
