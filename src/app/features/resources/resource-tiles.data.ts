import type { HubTileConfig, TileChip } from '../hub/hub-tile.types';
import { GlossaryPreviewComponent } from './previews/glossary-preview/glossary-preview.component';
import { StrategistGuidesPreviewComponent } from './previews/strategist-guides-preview/strategist-guides-preview.component';

const LEARN: TileChip = { kind: 'accent', label: 'Learn' };
const REFERENCE: TileChip = { kind: 'secondary', label: 'Reference' };
const COMMUNITY: TileChip = { kind: 'tertiary', label: 'Community' };

/**
 * What each link in the Resources hub looks like, in the order the tiles are laid out. The order is
 * the grid's reading order, so it is chosen so every row fills: sizes add up to six columns, with the
 * feature's two rows shared by the two tiles beside it.
 * A link missing here still gets a plain tile, after these.
 */
export const RESOURCE_TILES: readonly HubTileConfig[] = [
  { path: '/media-tutorials', size: 'feature', chip: LEARN, preview: null, imageUrl: '/images/site/banners/resources-banner.webp', playMarker: true },
  { path: '/user-highlights', size: 'third', chip: COMMUNITY, preview: null, imageUrl: null },
  { path: '/glossary', size: 'note', chip: REFERENCE, preview: GlossaryPreviewComponent, imageUrl: null },
  { path: '/strategist-guides', size: 'wide', chip: LEARN, preview: StrategistGuidesPreviewComponent, imageUrl: null },
];
