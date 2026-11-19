import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { COMMUNITY_EMPTY_RULE, CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { CommunityInsightsService } from './community-insights.service';
import { buildInsightsTabView } from './insights-tab-view';

/** When the community plays and wins, or the designed "not enough data yet" state. */
@Component({
  selector: 'app-community-insights-tab',
  imports: [CommunitySummaryComponent],
  templateUrl: './insights-tab.component.html',
  styleUrls: ['../../../shared/styles/stat-panels.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsTabComponent {
  /** `undefined` while loading, `null` when the answer could not be read. */
  private readonly insights = toSignal(inject(CommunityInsightsService).getInsights());

  protected readonly summary = `Win rate by day of the week, time of day and place in a play session. ${COMMUNITY_EMPTY_RULE}`;
  protected readonly view = computed(() => buildInsightsTabView(this.insights()));
}
