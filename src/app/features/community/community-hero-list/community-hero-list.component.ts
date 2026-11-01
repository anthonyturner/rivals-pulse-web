import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { HeroCellView } from '../../insights/hero-identity';

/** One hero in a summary list: the figure the list is ordered by, and the sample behind it when the list states one. */
export interface CommunityHeroRow extends HeroCellView {
  figure: string;
  sample?: string;
}

/** A ranked list of heroes, each linking to its place on the Heroes page. */
@Component({
  selector: 'app-community-hero-list',
  imports: [RouterLink],
  templateUrl: './community-hero-list.component.html',
  styleUrl: './community-hero-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityHeroListComponent {
  readonly heroes = input.required<readonly CommunityHeroRow[]>();
  /** Names what the figure is, for a screen reader: the visual list sits under a heading that says so. */
  readonly figureLabel = input.required<string>();

  protected onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }
}
