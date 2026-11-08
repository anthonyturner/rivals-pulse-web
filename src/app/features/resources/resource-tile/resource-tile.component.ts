import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { TileChip } from '../resource-tile.types';

/**
 * A link in a hub as a card: an optional category chip, the title, a one-line description and room
 * for a small preview, which goes in as content. The whole card is one link named by the title, so
 * the preview is decoration and is hidden from assistive technology. Give `imageUrl` for key art
 * behind a scrim, which makes the card the hub's lead tile.
 */
@Component({
  selector: 'app-resource-tile',
  imports: [RouterLink],
  templateUrl: './resource-tile.component.html',
  styleUrl: './resource-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.featured]': '!!imageUrl()' },
})
export class ResourceTileComponent {
  readonly title = input.required<string>();
  readonly route = input.required<string>();
  readonly description = input.required<string>();
  readonly chip = input<TileChip | null>(null);
  readonly imageUrl = input<string | null>(null);
}
