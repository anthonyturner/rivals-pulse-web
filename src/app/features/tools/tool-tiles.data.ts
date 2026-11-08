import type { HubTileConfig, TileChip } from '../hub/hub-tile.types';
import { CountersPreviewComponent } from './previews/counters-preview/counters-preview.component';
import { DivePlannerPreviewComponent } from './previews/dive-planner-preview/dive-planner-preview.component';
import { TeamBuilderPreviewComponent } from './previews/team-builder-preview/team-builder-preview.component';

const MATCHUPS: TileChip = { kind: 'tertiary', label: 'Matchups' };
const PLANNER: TileChip = { kind: 'secondary', label: 'Planner' };
const BUILDER: TileChip = { kind: 'accent', label: 'Builder' };

/**
 * What each released link in the Tools hub looks like, in the order the tiles are laid out. Counters
 * and the Dive Planner share two rows, and the Team Builder is a strip under them.
 */
export const TOOL_TILES: readonly HubTileConfig[] = [
  { path: '/counters', size: 'feature', chip: MATCHUPS, preview: CountersPreviewComponent, imageUrl: '/images/site/banners/counters-banner.webp', imageFit: 'cover', tint: 'danger' },
  { path: '/dive-planner', size: 'tall', chip: PLANNER, preview: DivePlannerPreviewComponent, imageUrl: null },
  { path: '/team-builder', size: 'wide', chip: BUILDER, preview: TeamBuilderPreviewComponent, imageUrl: null, split: true },
];
