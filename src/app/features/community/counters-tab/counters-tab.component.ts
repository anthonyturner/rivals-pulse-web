import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';

@Component({
  selector: 'app-community-counters-tab',
  imports: [CommunityEmptyStateComponent],
  template: `
    <app-community-empty-state
      heading="Community counter matchups"
      preview="Which heroes win when facing which, from real matches rather than guides."
      [link]="link"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountersTabComponent {
  protected readonly link = { label: 'Open the counters tool', path: '/counters' };
}
