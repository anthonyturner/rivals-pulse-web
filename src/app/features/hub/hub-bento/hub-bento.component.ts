import { NgComponentOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { HubTileComponent } from '../hub-tile/hub-tile.component';
import type { HubLink, HubTileConfig } from '../hub-tile.types';

const PLAIN_TILE: Omit<HubTileConfig, 'path'> = { size: 'third', chip: null, preview: null, imageUrl: null };

/**
 * A hub's links as a bento grid of mixed-size tiles, each with a chip for its kind and, where the
 * site has the data, a small live preview. The hub passes in its own `config`: which tile a link
 * is given, and in what order, is the order of that list. A link the config does not name still
 * shows, as a plain tile at the end.
 */
@Component({
  selector: 'app-hub-bento',
  imports: [HubTileComponent, NgComponentOutlet],
  templateUrl: './hub-bento.component.html',
  styleUrl: './hub-bento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HubBentoComponent {
  readonly links = input.required<readonly HubLink[]>();
  readonly config = input.required<readonly HubTileConfig[]>();
  /** The level of each tile's title: 2 when the grid sits under the page title, 3 under a section heading. */
  readonly headingLevel = input<2 | 3>(2);

  protected readonly tiles = computed(() => {
    const config = this.config();
    const placeOf = (path: string): number => {
      const index = config.findIndex((tile) => tile.path === path);

      return index === -1 ? config.length : index;
    };

    return this.links()
      .map((link) => ({ ...link, ...(config.find((tile) => tile.path === link.path) ?? PLAIN_TILE) }))
      .sort((a, b) => placeOf(a.path) - placeOf(b.path));
  });
}
