import type { ResourceTileConfig, TileChip } from './resource-tile.types';

const LEARN: TileChip = { kind: 'learn', label: 'Learn' };
const STATS: TileChip = { kind: 'stats', label: 'Stats' };
const REFERENCE: TileChip = { kind: 'stats', label: 'Reference' };
const COMMUNITY: TileChip = { kind: 'community', label: 'Community' };

/**
 * What each link in the Resources hub looks like, in the order the tiles are laid out. The order is
 * the grid's reading order, so it is chosen so every row fills: sizes add up to six columns.
 * A link missing here still gets a plain tile, after these.
 */
export const RESOURCE_TILES: readonly ResourceTileConfig[] = [
  { path: '/media-tutorials', size: 'feature', chip: LEARN, preview: null, imageUrl: '/images/site/heroes-banner.jpg' },
  { path: '/tier-list', size: 'tall', chip: COMMUNITY, preview: 'tier-list', imageUrl: null },
  { path: '/win-rates', size: 'half', chip: STATS, preview: 'hero-stats', imageUrl: null },
  { path: '/strategist-guides', size: 'half', chip: LEARN, preview: 'strategist-guides', imageUrl: null },
  { path: '/user-highlights', size: 'third', chip: COMMUNITY, preview: null, imageUrl: null },
  { path: '/game-stats', size: 'third', chip: STATS, preview: 'roster', imageUrl: null },
  { path: '/glossary', size: 'note', chip: REFERENCE, preview: 'glossary', imageUrl: null },
  { path: '/team-comps', size: 'wide', chip: STATS, preview: 'team-comps', imageUrl: null },
];
