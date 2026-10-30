import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { HeroProgressRow } from './hero-progress';

/** Heroes that are "not enough data yet", each with how far it is from the minimum. */
@Component({
  selector: 'app-hero-progress-list',
  templateUrl: './hero-progress-list.component.html',
  styleUrl: './hero-progress-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroProgressListComponent {
  readonly rows = input.required<readonly HeroProgressRow[]>();

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }
}
