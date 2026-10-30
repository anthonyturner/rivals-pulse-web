import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';

@Component({
  selector: 'app-community-tier-list-tab',
  imports: [CommunityEmptyStateComponent],
  template: `
    <app-community-empty-state
      heading="Community tier list"
      preview="A hero tier list ranked by what the community actually wins with."
      [link]="link"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierListTabComponent {
  protected readonly link = { label: 'See the current tier list', path: '/tier-list' };
}
