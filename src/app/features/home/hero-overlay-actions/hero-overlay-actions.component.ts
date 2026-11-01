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
import { HomeHeroStatsService } from '../home-hero-stats.service';
import { buildHeroTrustLine } from './hero-trust-line-view';

/**
 * The hero's two buttons, the link to the FAQ, and the line saying how many matches stand
 * behind the site's numbers.
 */
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
  readonly trustLine = computed(() => {
    const stats = this.stats();

    return stats === undefined ? null : buildHeroTrustLine(stats);
  });

  constructor() {
    // The server render shows the reserved, empty line; the browser fetches the shared stats.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(HomeHeroStatsService)
        .getHeroStats()
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe((stats) => this.stats.set(stats));
    }
  }
}
