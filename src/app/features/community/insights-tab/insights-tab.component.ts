import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';

@Component({
  selector: 'app-community-insights-tab',
  imports: [CommunityEmptyStateComponent],
  template: `
    <app-community-empty-state
      heading="When the community plays and wins"
      preview="Win rate by day of the week and time of day, and how long play sessions last."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsTabComponent {}
