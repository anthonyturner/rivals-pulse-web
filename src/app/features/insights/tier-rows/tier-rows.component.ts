import { NgTemplateOutlet } from '@angular/common';
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HeroTileComponent } from '../hero-tile/hero-tile.component';
import type { TierRowView } from '../tier-list/tier-list-view';

/** Tier rows as the tier list draws them: a coloured letter strip, then a grid of hero tiles. */
@Component({
  selector: 'app-tier-rows',
  imports: [HeroTileComponent, NgTemplateOutlet],
  templateUrl: './tier-rows.component.html',
  styleUrl: './tier-rows.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierRowsComponent {
  readonly tiers = input.required<readonly TierRowView[]>();
  /** Makes each tile a link to its hero on the Heroes page. */
  readonly linkHeroes = input(false);
  /** Draws each hero tile in the art-led look of the redesigned pages. */
  readonly artLed = input(false, { transform: booleanAttribute });
  /** The level of each row's heading, so a page keeps its heading order. */
  readonly headingLevel = input<2 | 3>(2);
}
