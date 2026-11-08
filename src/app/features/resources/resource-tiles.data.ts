import type { HubTileConfig, TileChip } from '../hub/hub-tile.types';
import { GlossaryPreviewComponent } from './previews/glossary-preview/glossary-preview.component';
import { HeroStatsPreviewComponent } from './previews/hero-stats-preview/hero-stats-preview.component';
import { RosterPreviewComponent } from './previews/roster-preview/roster-preview.component';
import { StrategistGuidesPreviewComponent } from './previews/strategist-guides-preview/strategist-guides-preview.component';
import { TeamCompsPreviewComponent } from './previews/team-comps-preview/team-comps-preview.component';
import { TierListPreviewComponent } from './previews/tier-list-preview/tier-list-preview.component';

const LEARN: TileChip = { kind: 'accent', label: 'Learn' };
const STATS: TileChip = { kind: 'secondary', label: 'Stats' };
const REFERENCE: TileChip = { kind: 'secondary', label: 'Reference' };
const COMMUNITY: TileChip = { kind: 'tertiary', label: 'Community' };

/**
 * What each link in the Resources hub looks like, in the order the tiles are laid out. The order is
 * the grid's reading order, so it is chosen so every row fills: sizes add up to six columns.
 * A link missing here still gets a plain tile, after these.
 */
export const RESOURCE_TILES: readonly HubTileConfig[] = [
  { path: '/media-tutorials', size: 'feature', chip: LEARN, preview: null, imageUrl: '/images/site/banners/resources-banner.webp', playMarker: true },
  { path: '/tier-list', size: 'tall', chip: COMMUNITY, preview: TierListPreviewComponent, imageUrl: null },
  { path: '/win-rates', size: 'half', chip: STATS, preview: HeroStatsPreviewComponent, imageUrl: null },
  { path: '/strategist-guides', size: 'half', chip: LEARN, preview: StrategistGuidesPreviewComponent, imageUrl: null },
  { path: '/user-highlights', size: 'third', chip: COMMUNITY, preview: null, imageUrl: null },
  { path: '/game-stats', size: 'third', chip: STATS, preview: RosterPreviewComponent, imageUrl: null },
  { path: '/glossary', size: 'note', chip: REFERENCE, preview: GlossaryPreviewComponent, imageUrl: null },
  { path: '/team-comps', size: 'wide', chip: STATS, preview: TeamCompsPreviewComponent, imageUrl: null },
  { path: '/records', size: 'wide', chip: COMMUNITY, preview: null, imageUrl: null },
];
