import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { TierListHero } from '../../../../../contracts/tier-list.model';

@Component({
  selector: 'app-hero-usage-section',
  templateUrl: './hero-usage-section.component.html',
  styleUrls: ['../season-section.shared.css', './hero-usage-section.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroUsageSectionComponent {
  readonly headingId = input('season-meta-title');
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly heroes = input.required<readonly TierListHero[]>();
  readonly metaLabel = input.required<string>();
  readonly sourceLabel = input('Rivals Meta source');
  readonly sourceUrl = input('https://rivalsmeta.com/characters');

  formatRate(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  formatMatches(value: number): string {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = '/images/heroes/default-hero.png';
  }
}
