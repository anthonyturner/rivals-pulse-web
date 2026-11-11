import { ChangeDetectionStrategy, Component } from '@angular/core';

import { reportContentState } from '../../../core/seo/thin-content';
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
 * A stand-in until the tier list and the hero stats table become this tab. It points to the two pages
 * that hold those numbers today, and reports that it has nothing of its own to read.
 */
@Component({
  selector: 'app-stats-heroes',
  imports: [HubBentoComponent],
  template: `
    <p class="intro">The hero tier list and the hero stats table are still on their own pages, and move here soon.</p>
    <app-hub-bento [links]="links" [config]="tiles" />
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
      min-width: 0;
    }

    .intro {
      margin: 0;
      color: var(--text-soft);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsHeroesComponent {
  protected readonly links = LINKS;
  protected readonly tiles = TILES;

  constructor() {
    reportContentState(() => 'thin');
  }
}
