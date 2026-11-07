import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { GetAppButtonComponent } from '../../../shared/components/get-app-button/get-app-button.component';
import { OVERWOLF_LISTING_STATS } from '../../../shared/overwolf-app';
import { HomeHeroStatsService } from '../home-hero-stats.service';
import { buildHeroStatRow } from './hero-stat-row-view';

/** The hero's two buttons and the row of figures under them: downloads, rating and matches counted. */
@Component({
  selector: 'app-hero-overlay-actions',
  imports: [GetAppButtonComponent, RouterLink],
  templateUrl: './hero-overlay-actions.component.html',
  styleUrl: './hero-overlay-actions.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroOverlayActionsComponent {
  /** `undefined` while the stats load, `null` when they could not be read. */
  private readonly stats = signal<HeroStats | null | undefined>(undefined);

  readonly loading = computed(() => this.stats() === undefined);
  readonly statRow = computed(() => buildHeroStatRow(OVERWOLF_LISTING_STATS, this.stats() ?? null));

  constructor() {
    // The server render shows the listing figures and a reserved matches slot; the browser fetches the stats.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(HomeHeroStatsService)
        .getHeroStats()
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe((stats) => this.stats.set(stats));
    }
  }
}
