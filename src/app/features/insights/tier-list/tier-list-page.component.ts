import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, switchMap, tap } from 'rxjs';

import type { HeroStats, HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { DEFAULT_MODE_ID, heroStatsModeOptions, type ModeOption } from '../../../shared/utilities/play-modes';
import { HeroDataService } from '../../heroes/hero-data.service';
import { heroIdentities } from '../hero-identity';
import { HeroProgressListComponent } from '../hero-progress-list/hero-progress-list.component';
import { HeroStatsService } from '../hero-stats.service';
import { buildTierListView, seasonOptions, type SeasonOption } from './tier-list-view';

interface TierListRequest {
  halfSeason: number | undefined;
  mode: HeroStatsModeId;
}

/** The community tier list: Rivals Pulse players' matches only, all ranks together. */
@Component({
  selector: 'app-tier-list-page',
  imports: [FilterSelectComponent, HeroProgressListComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tier-list-page.component.html',
  styleUrl: './tier-list-page.component.css',
})
export class TierListPageComponent {
  private readonly heroStats = inject(HeroStatsService);
  private readonly chosenSeason = signal<number | undefined>(undefined);
  private readonly chosenMode = signal<HeroStatsModeId>(DEFAULT_MODE_ID);
  /** True from choosing another half-season or mode until its numbers arrive, so the last one's are not shown under the new label. */
  private readonly pending = signal(false);
  /** Kept from the last answer, so the pickers stay when a request for one half-season or mode fails. */
  readonly seasons = signal<SeasonOption[]>([]);
  readonly modes = signal<ModeOption[]>([]);
  private readonly requested = new BehaviorSubject<TierListRequest>({ halfSeason: undefined, mode: DEFAULT_MODE_ID });
  // undefined while the first request runs, null once a request has failed.
  private readonly stats = toSignal(
    this.requested.pipe(
      switchMap(({ halfSeason, mode }) =>
        this.heroStats.getHeroStats(halfSeason, mode).pipe(
          tap((stats) => {
            this.rememberPickers(stats);
            this.pending.set(false);
          }),
        ),
      ),
    ),
  );
  private readonly heroes = toSignal(inject(HeroDataService).getHeroes());
  private readonly identities = computed(() => heroIdentities(this.heroes() ?? []));

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  readonly loading = computed(
    () => this.stats() === undefined || this.heroes() === undefined || this.pending(),
  );
  readonly failed = computed(() => this.stats() === null && !this.pending());
  readonly view = computed(() => {
    const stats = this.stats();

    return stats && !this.loading() ? buildTierListView(stats, this.identities()) : null;
  });
  readonly seasonChoices = computed(() => this.seasons().map(({ id, label }) => ({ value: String(id), label })));
  readonly modeChoices = computed(() => this.modes().map(({ id, label }) => ({ value: id, label })));
  /** Hidden until the first numbers are in, so they do not push the loading panel down when they appear. */
  private readonly pickersReady = computed(() => this.view() !== null || this.failed() || this.pending());
  readonly showSeasonPicker = computed(() => this.seasons().length > 1 && this.pickersReady());
  readonly showModePicker = computed(() => this.modes().length > 1 && this.pickersReady());
  readonly selectedSeason = computed(() => {
    const id = this.chosenSeason() ?? this.view()?.season?.id;

    return id === undefined ? undefined : String(id);
  });
  readonly selectedMode = this.chosenMode.asReadonly();

  chooseSeason(value: string): void {
    this.request(Number(value), this.chosenMode());
  }

  chooseMode(value: string): void {
    this.request(this.chosenSeason(), value as HeroStatsModeId);
  }

  onImageError(event: Event): void {
    (event.target as HTMLImageElement).src = '/images/heroes/default-hero.png';
  }

  private request(halfSeason: number | undefined, mode: HeroStatsModeId): void {
    this.chosenSeason.set(halfSeason);
    this.chosenMode.set(mode);
    this.pending.set(true);
    this.requested.next({ halfSeason, mode });
  }

  private rememberPickers(stats: HeroStats | null): void {
    if (stats !== null && stats.halfSeasons.length > 0) {
      this.seasons.set(seasonOptions(stats.halfSeasons));
    }

    if (stats !== null) {
      this.modes.set(heroStatsModeOptions(stats, this.chosenMode()));
    }
  }
}
