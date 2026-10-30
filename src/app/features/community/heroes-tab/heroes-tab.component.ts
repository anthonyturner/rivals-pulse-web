import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CommunityEmptyStateComponent } from '../community-empty-state/community-empty-state.component';

@Component({
  selector: 'app-community-heroes-tab',
  imports: [CommunityEmptyStateComponent],
  template: `
    <app-community-empty-state
      heading="Community hero pick rates and win rates"
      preview="Which heroes the community plays most and how often each one wins, the way the Heroes screen of the app shows your own."
      [link]="link"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroesTabComponent {
  protected readonly link = { label: 'Browse the hero encyclopedia', path: '/heroes' };
}
