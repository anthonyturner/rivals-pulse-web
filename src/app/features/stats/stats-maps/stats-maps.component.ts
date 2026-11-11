import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { reportContentState } from '../../../core/seo/thin-content';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';

/** A stand-in until the community's best and worst maps are counted: it says so, and reports that it has nothing to read. */
@Component({
  selector: 'app-stats-maps',
  imports: [RouterLink, StatePanelComponent],
  templateUrl: './stats-maps.component.html',
  styleUrl: './stats-maps.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsMapsComponent {
  constructor() {
    reportContentState(() => 'thin');
  }
}
