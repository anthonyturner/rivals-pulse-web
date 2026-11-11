import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { reportContentState } from '../../../core/seo/thin-content';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';

/** A stand-in until the community's best and worst maps are counted: it says so, and reports that it has nothing to read. */
@Component({
  selector: 'app-stats-maps',
  imports: [RouterLink, StatePanelComponent],
  template: `
    <app-state-panel heading="Map stats are coming soon">
      <p>
        Which maps players win and lose on most will be listed here once enough matches are counted. The
        <a routerLink="/stats">overview</a> already shows the win rate on each map from the matches counted so far.
      </p>
    </app-state-panel>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    a {
      color: var(--link);
      text-decoration: underline;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsMapsComponent {
  constructor() {
    reportContentState(() => 'thin');
  }
}
