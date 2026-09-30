import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { SeasonUpdate } from '../../home-season.model';

@Component({
  selector: 'app-season-updates-section',
  templateUrl: './season-updates-section.component.html',
  styleUrls: ['../season-section.shared.css', './season-updates-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeasonUpdatesSectionComponent {
  readonly headingId = input('season-updates-title');
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly updates = input.required<readonly SeasonUpdate[]>();
}
