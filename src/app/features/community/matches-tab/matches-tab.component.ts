import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';

@Component({
  selector: 'app-community-matches-tab',
  imports: [CommunityEmptyStateComponent],
  template: `
    <app-community-empty-state
      heading="Community matches"
      preview="Win rate by map, the mix of game modes, average match length and matches per day across the community."
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchesTabComponent {}
