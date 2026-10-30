import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BehaviorSubject, switchMap, tap } from 'rxjs';

import type { HeroStats } from '../../../../contracts/hero-stats.model';
import { HeroDataService } from '../../heroes/hero-data.service';
import { heroIdentities } from '../hero-identity';
import { HeroProgressListComponent } from '../hero-progress-list/hero-progress-list.component';
import { HeroStatsService } from '../hero-stats.service';
import { buildTierListView, seasonOptions, type SeasonOption } from './tier-list-view';

/** The community tier list: Rivals Pulse players' matches only, all ranks together. */
@Component({
  selector: 'app-tier-list-page',
  imports: [HeroProgressListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tier-list-page.component.html',
  styleUrl: './tier-list-page.component.css',
})
export class TierListPageComponent {
  private readonly heroStats = inject(HeroStatsService);
  private readonly chosenSeason = signal<number | undefined>(undefined);
  /** Kept from the last answer, so the picker stays when a request for one half-season fails. */
  readonly seasons = signal<SeasonOption[]>([]);
  private readonly requested = new BehaviorSubject<number | undefined>(undefined);
  // undefined while the first request runs, null once a request has failed.
  private readonly stats = toSignal(
    this.requested.pipe(
      switchMap((halfSeason) =>
        this.heroStats.getHeroStats(halfSeason).pipe(tap((stats) => this.rememberSeasons(stats))),
      ),
    ),
  );
  private readonly heroes = toSignal(inject(HeroDataService).getHeroes());
  private readonly identities = computed(() => heroIdentities(this.heroes() ?? []));

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  readonly loading = computed(() => this.stats() === undefined || this.heroes() === undefined);
  readonly failed = computed(() => this.stats() === null);
  readonly view = computed(() => {
    const stats = this.stats();

    return stats && !this.loading() ? buildTierListView(stats, this.identities()) : null;
  });
  readonly selectedSeason = computed(() => this.chosenSeason() ?? this.view()?.season?.id);

  chooseSeason(event: Event): void {
    const halfSeason = Number((event.target as HTMLSelectElement).value);

    this.chosenSeason.set(halfSeason);
    this.requested.next(halfSeason);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }

  private rememberSeasons(stats: HeroStats | null): void {
    if (stats !== null && stats.halfSeasons.length > 0) {
      this.seasons.set(seasonOptions(stats.halfSeasons));
    }
  }
}
