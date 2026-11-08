import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { GlossaryPreviewComponent } from '../previews/glossary-preview/glossary-preview.component';
import { HeroStatsPreviewComponent } from '../previews/hero-stats-preview/hero-stats-preview.component';
import { RosterPreviewComponent } from '../previews/roster-preview/roster-preview.component';
import { StrategistGuidesPreviewComponent } from '../previews/strategist-guides-preview/strategist-guides-preview.component';
import { TeamCompsPreviewComponent } from '../previews/team-comps-preview/team-comps-preview.component';
import { TierListPreviewComponent } from '../previews/tier-list-preview/tier-list-preview.component';
import { ResourceTileComponent } from '../resource-tile/resource-tile.component';
import type { ResourceTileConfig } from '../resource-tile.types';
import { RESOURCE_TILES } from '../resource-tiles.data';

export interface ResourceLink {
  label: string;
  path: string;
  description: string;
}

const PLAIN_TILE: Omit<ResourceTileConfig, 'path'> = { size: 'third', chip: null, preview: null, imageUrl: null };

/**
 * The Resources hub's links as a bento grid of mixed-size tiles, each with a chip for its kind and,
 * where the site has the data, a small live preview. Which tile a link gets, and in what order, is
 * in `RESOURCE_TILES`; a link it does not name still shows, as a plain tile at the end.
 */
@Component({
  selector: 'app-resource-bento',
  imports: [
    GlossaryPreviewComponent,
    HeroStatsPreviewComponent,
    ResourceTileComponent,
    RosterPreviewComponent,
    StrategistGuidesPreviewComponent,
    TeamCompsPreviewComponent,
    TierListPreviewComponent,
  ],
  templateUrl: './resource-bento.component.html',
  styleUrl: './resource-bento.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceBentoComponent {
  readonly links = input.required<readonly ResourceLink[]>();

  protected readonly tiles = computed(() =>
    this.links()
      .map((link) => ({ ...link, ...(RESOURCE_TILES.find((tile) => tile.path === link.path) ?? PLAIN_TILE) }))
      .sort((a, b) => placeOf(a.path) - placeOf(b.path)),
  );
}

/** A link the tile data does not name goes after the ones it does; the sort keeps their given order. */
function placeOf(path: string): number {
  const index = RESOURCE_TILES.findIndex((tile) => tile.path === path);

  return index === -1 ? RESOURCE_TILES.length : index;
}
