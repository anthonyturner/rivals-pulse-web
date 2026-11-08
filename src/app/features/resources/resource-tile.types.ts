/** What a tile's category chip stands for: yellow for learning, indigo for stats and reference, violet for community. */
export type TileChipKind = 'learn' | 'stats' | 'community';

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

/** The small live preview a tile carries; a tile with none shows its title, chip and description only. */
export type TilePreview = 'tier-list' | 'hero-stats' | 'strategist-guides' | 'roster' | 'glossary' | 'team-comps';

export interface ResourceTileConfig {
  /** The link the tile stands for, as the hub's data spells it. */
  path: string;
  size: TileSize;
  chip: TileChip | null;
  preview: TilePreview | null;
  /** Key art behind the tile, under a scrim. */
  imageUrl: string | null;
}
