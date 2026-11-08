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

/** A soft wash of colour in a tile's top-right corner. `danger` is a red wash, drawn with the `--danger` token. */
export type TileTint = 'danger';

/**
 * How key art sits in a lead tile:
 * - `banner`: a wide picture, zoomed in and pinned to the lower left so its centre falls out of frame.
 * - `portrait`: a square picture at the tile's height, against the right edge, with the text to its left.
 */
export type TileImageFit = 'banner' | 'portrait';

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
  /** Key art behind the tile, under a scrim, which also makes it the dark lead tile. */
  imageUrl: string | null;
  /** A play button over the key art, for a tile that opens video. Only drawn with `imageUrl`. */
  playMarker?: boolean;
  /** How the key art sits in the tile. Only used with `imageUrl`; a banner when left out. */
  imageFit?: TileImageFit;
  /** Wait to load the key art until it nears the screen, for a lead tile below the fold. Eager when left out, so art in view loads at once. */
  lazyArt?: boolean;
  /** A small square picture beside the text, for a tile with no key art. A tile with `imageUrl` ignores it. */
  thumbnailUrl?: string | null;
  tint?: TileTint;
  /** Text on the left and the preview on the right, for a full-width strip. A tablet stacks them. */
  split?: boolean;
}
