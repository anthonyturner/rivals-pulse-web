import { ChangeDetectionStrategy, Component } from '@angular/core';

import { HeroesTabComponent } from '../../community/heroes-tab/heroes-tab.component';
import { HubBentoComponent } from '../../hub/hub-bento/hub-bento.component';
import type { HubLink, HubTileConfig } from '../../hub/hub-tile.types';
import { HeroStatsPreviewComponent } from '../../resources/previews/hero-stats-preview/hero-stats-preview.component';
import { TierListPreviewComponent } from '../../resources/previews/tier-list-preview/tier-list-preview.component';

const LINKS: readonly HubLink[] = [
  {
    label: 'Tier list',
    path: '/tier-list',
    description: 'Community hero tiers from RivalsPulse players, by half-season.',
  },
  {
    label: 'Hero stats',
    path: '/win-rates',
    description: 'Compare hero win and pick rates from RivalsPulse matches.',
  },
];

const TILES: readonly HubTileConfig[] = [
  {
    path: '/tier-list',
    size: 'half',
    chip: { kind: 'tertiary', label: 'Community' },
    preview: TierListPreviewComponent,
    imageUrl: null,
  },
  {
    path: '/win-rates',
    size: 'half',
    chip: { kind: 'secondary', label: 'Stats' },
    preview: HeroStatsPreviewComponent,
    imageUrl: null,
  },
];

/**
 * The hero numbers (most picked, highest win rate, and per-minute damage, healing and damage blocked),
 * with links below to the two pages that hold the full tier list and hero stats table until they
 * become this tab. The tab reports no content state of its own: each number section does, so the tab
 * is thin only when every section is.
 */
@Component({
  selector: 'app-stats-heroes',
  imports: [HeroesTabComponent, HubBentoComponent],
  templateUrl: './stats-heroes.component.html',
  styleUrl: './stats-heroes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsHeroesComponent {
  protected readonly links = LINKS;
  protected readonly tiles = TILES;
}
