import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';

@Component({
  selector: 'app-community-stats-tab',
  imports: [CommunityEmptyStateComponent],
  template: `
    <app-community-empty-state
      heading="Community role benchmarks"
      preview="What a normal KDA, final hits and win rate look like for each role, so you can compare your own."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsTabComponent {}
