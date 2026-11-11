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

import type { CommunityMatches } from '../../../../contracts/community-matches.model';
import { GetAppButtonComponent } from '../../../shared/components/get-app-button/get-app-button.component';
import { OVERWOLF_LISTING_STATS } from '../../../shared/overwolf-app';
import { CommunityMatchesService } from '../../community/matches-tab/community-matches.service';
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
  /** `undefined` while the figures load, `null` when they could not be read. */
  private readonly matches = signal<CommunityMatches | null | undefined>(undefined);

  readonly loading = computed(() => this.matches() === undefined);
  readonly statRow = computed(() => buildHeroStatRow(OVERWOLF_LISTING_STATS, this.matches() ?? null));

  constructor() {
    // The server render shows the listing figures and a reserved matches slot; the browser fetches the match figures.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(CommunityMatchesService)
        .getMatches()
        .pipe(takeUntilDestroyed(inject(DestroyRef)))
        .subscribe((matches) => this.matches.set(matches));
    }
  }
}
