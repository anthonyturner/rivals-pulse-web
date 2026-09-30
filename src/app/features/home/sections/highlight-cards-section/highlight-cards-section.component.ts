import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { SeasonHighlight } from '../../home-season.model';

@Component({
  selector: 'app-highlight-cards-section',
  templateUrl: './highlight-cards-section.component.html',
  styleUrls: ['../season-section.shared.css', './highlight-cards-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighlightCardsSectionComponent {
  readonly headingId = input('season-highlights-title');
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly highlights = input.required<readonly SeasonHighlight[]>();
  readonly columns = input<3 | 4>(3);
  readonly sourceLabel = input<string | undefined>();
  readonly sourceUrl = input<string | undefined>();
}
