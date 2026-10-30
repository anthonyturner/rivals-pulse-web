import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { HeroUsageView } from './hero-usage-view';

/** The most-picked heroes from Rivals Pulse players' matches, or the reason there are none to show yet. */
@Component({
  selector: 'app-hero-usage-section',
  imports: [RouterLink],
  templateUrl: './hero-usage-section.component.html',
  styleUrls: ['../season-section.shared.css', './hero-usage-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroUsageSectionComponent {
  readonly headingId = input('season-meta-title');
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly view = input.required<HeroUsageView>();

  /** Placeholder positions, counted rather than drawn from data, so a template can loop over them. */
  placeholders(count: number): number[] {
    return Array.from({ length: count }, (_, index) => index);
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = '/images/heroes/default-hero.png';
  }
}
