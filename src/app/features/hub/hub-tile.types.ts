import type { Type } from '@angular/core';

/** What a tile's category chip is tinted with: the accent (yellow), the secondary (indigo) or the tertiary (violet). */
export type TileChipKind = 'accent' | 'secondary' | 'tertiary';

export interface TileChip {
  kind: TileChipKind;
  label: string;
}

/**
 * How much of the six-column grid a tile takes on a desktop:
 * - `feature`: four columns, two rows.
 * - `tall`: two columns, two rows.
 * - `half`: three columns.
 * - `third`: two columns.
 * - `note`: two columns, and the full row on a tablet, for a tile that holds a sentence.
 * - `wide`: the whole row.
 */
export type TileSize = 'feature' | 'tall' | 'half' | 'third' | 'note' | 'wide';

/** A soft wash of colour in a tile's top-right corner. `danger` is the red the site uses for the enemy side. */
export type TileTint = 'danger';

/** A hub link as the navigation data spells it. */
export interface HubLink {
  label: string;
  path: string;
  description: string;
}

export interface HubTileConfig {
  /** The link the tile stands for, as the hub's data spells it. */
  path: string;
  size: TileSize;
  chip: TileChip | null;
  /**
   * The small live preview the tile carries, as the component to draw; a tile with none shows its
   * title, chip and description only. The preview is decoration: it is hidden from assistive
   * technology and must draw nothing, rather than a placeholder, while it has no data.
   */
  preview: Type<unknown> | null;
  /** Key art behind the tile, under a scrim. */
  imageUrl: string | null;
  tint?: TileTint;
  /** Text on the left and the preview on the right, for a full-width strip. A tablet stacks them. */
  split?: boolean;
}
