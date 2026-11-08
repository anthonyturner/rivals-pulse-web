import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { TileChip, TileImageFit, TileTint } from '../hub-tile.types';
import { KindChipComponent } from '../kind-chip/kind-chip.component';

/**
 * A link in a hub as a card: an optional category chip, the title, a one-line description and room
 * for a small preview, which goes in as content. With a `route` the whole card is one link named by
 * the title; without one it is not a link at all, so the title is plain text and the card does not
 * lift on hover. Either way the preview is decoration and is hidden from assistive technology. Give `imageUrl` for key art
 * behind a scrim, which makes the card the hub's lead tile, and `playMarker` to add a play button
 * over it for a card that opens video; `imageFit` says how the art sits, and `lazyArt` defers loading
 * it for a card that starts below the fold. A card with no key art can
 * give `thumbnailUrl` for a small square picture beside its text. A card with no `route` can carry
 * its own links or buttons: content marked `tile-actions` sits under the description and, unlike the
 * preview, stays visible to assistive technology.
 */
@Component({
  selector: 'app-hub-tile',
  imports: [KindChipComponent, NgTemplateOutlet, RouterLink],
  templateUrl: './hub-tile.component.html',
  styleUrl: './hub-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.featured]': '!!imageUrl()',
    '[class.portrait]': '!!imageUrl() && imageFit() === "portrait"',
    '[class.cover]': '!!imageUrl() && imageFit() === "cover"',
    '[class.thumbed]': '!imageUrl() && !!thumbnailUrl()',
    '[class.split]': 'split()',
    '[class.static]': '!route()',
    '[attr.data-tint]': 'tint()',
  },
})
export class HubTileComponent {
  readonly title = input.required<string>();
  readonly route = input<string | null>(null);
  readonly description = input.required<string>();
  readonly chip = input<TileChip | null>(null);
  readonly imageUrl = input<string | null>(null);
  /** The title's heading level: 2 under the page title, 3 under a section heading. */
  readonly headingLevel = input<2 | 3>(2);
  readonly playMarker = input(false);
  readonly imageFit = input<TileImageFit>('banner');
  readonly lazyArt = input(false);
  readonly thumbnailUrl = input<string | null>(null);
  readonly tint = input<TileTint | null>(null);
  readonly split = input(false);
}
