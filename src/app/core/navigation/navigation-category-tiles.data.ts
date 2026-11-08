import type { HubTileConfig } from '../../features/hub/hub-tile.types';
import { RESOURCE_TILES } from '../../features/resources/resource-tiles.data';
import { TOOL_TILES } from '../../features/tools/tool-tiles.data';

/** The tiles of each hub that draws as a bento grid, by the hub's path. */
export const NAVIGATION_CATEGORY_TILES: Readonly<Record<string, readonly HubTileConfig[]>> = {
  '/resources': RESOURCE_TILES,
  '/tools': TOOL_TILES,
};
