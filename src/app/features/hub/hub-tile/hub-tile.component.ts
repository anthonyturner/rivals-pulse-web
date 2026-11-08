import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { TileChip, TileImageFit, TileTint } from '../hub-tile.types';

/**
 * A link in a hub as a card: an optional category chip, the title, a one-line description and room
 * for a small preview, which goes in as content. The whole card is one link named by the title, so
 * the preview is decoration and is hidden from assistive technology. Give `imageUrl` for key art
 * behind a scrim, which makes the card the hub's lead tile, and `playMarker` to add a play button
 * over it for a card that opens video; `imageFit` says how the art sits. A card with no key art can
 * give `thumbnailUrl` for a small square picture beside its text.
 */
@Component({
  selector: 'app-hub-tile',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './hub-tile.component.html',
  styleUrl: './hub-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.featured]': '!!imageUrl()',
    '[class.portrait]': 'imageFit() === "portrait"',
    '[class.thumbed]': '!imageUrl() && !!thumbnailUrl()',
    '[class.split]': 'split()',
    '[attr.data-tint]': 'tint()',
  },
})
export class HubTileComponent {
  readonly title = input.required<string>();
  readonly route = input.required<string>();
  readonly description = input.required<string>();
  readonly chip = input<TileChip | null>(null);
  readonly imageUrl = input<string | null>(null);
  /** The title's heading level: 2 under the page title, 3 under a section heading. */
  readonly headingLevel = input<2 | 3>(2);
  readonly playMarker = input(false);
  readonly imageFit = input<TileImageFit>('banner');
  readonly thumbnailUrl = input<string | null>(null);
  readonly tint = input<TileTint | null>(null);
  readonly split = input(false);
}
