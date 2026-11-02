import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, map, switchMap, tap } from 'rxjs';

import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';
import { DEFAULT_MODE_ID, heroStatsModeOptions, type ModeOption } from '../../../shared/utilities/play-modes';
import { HeroDataService } from '../../heroes/hero-data.service';
import { HeroProgressListComponent } from '../hero-progress-list/hero-progress-list.component';
import { HeroStatsService } from '../hero-stats.service';
import { heroIdentities } from '../hero-identity';
import { buildWinRatesView } from './win-rates-view';

@Component({
  selector: 'app-win-rates-page',
  imports: [
    FilterSelectComponent,
    HeroImageFallbackDirective,
    HeroProgressListComponent,
    NoticeComponent,
    RouterLink,
    StatePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './win-rates-page.component.html',
  styleUrls: ['../insight-page.css', './win-rates-page.component.css'],
})
export class WinRatesPageComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly requestedSeason = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('season'))),
    { initialValue: this.route.snapshot.paramMap.get('season') },
  );
  private readonly heroStats = inject(HeroStatsService);
  private readonly chosenMode = signal<HeroStatsModeId>(DEFAULT_MODE_ID);
  /** True from choosing another mode until its numbers arrive, so the last mode's are not shown under the new label. */
  private readonly pending = signal(false);
  private readonly choiceMade = signal(false);
  /** Kept from the last answer, so the picker stays when a request for one mode fails. */
  private readonly modes = signal<ModeOption[]>([]);
  private readonly requested = new BehaviorSubject<HeroStatsModeId>(DEFAULT_MODE_ID);
  // undefined while the first request runs, null once a request has failed.
  private readonly stats = toSignal(
    this.requested.pipe(
      switchMap((mode) =>
        this.heroStats.getHeroStats(undefined, mode).pipe(
          tap((stats) => {
            if (stats !== null) {
              this.modes.set(heroStatsModeOptions(stats, this.chosenMode()));
            }

            this.pending.set(false);
          }),
        ),
      ),
    ),
  );
  private readonly heroes = toSignal(inject(HeroDataService).getHeroes());
  private readonly identities = computed(() => heroIdentities(this.heroes() ?? []));

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  readonly loading = computed(() => this.stats() === undefined || this.heroes() === undefined || this.pending());
  readonly failed = computed(() => this.stats() === null && !this.pending());
  readonly view = computed(() => {
    const stats = this.stats();

    return stats && !this.loading()
      ? buildWinRatesView(stats, this.requestedSeason(), this.identities())
      : null;
  });

  readonly modeChoices = computed(() => this.modes().map(({ id, label }) => ({ value: id, label })));
  /**
   * Hidden until the first numbers are in, so it does not push the loading panel down when it
   * appears, and for a season this page does not show, where a mode changes nothing.
   */
  readonly showModePicker = computed(
    () =>
      this.modes().length > 1 &&
      this.view()?.state !== 'unavailable-season' &&
      (this.view() !== null || this.failed() || this.pending()),
  );
  readonly selectedMode = this.chosenMode.asReadonly();
  /** With no picker to say which mode is counted, the meta line says it. */
  readonly meta = computed(() => {
    const view = this.view();

    if (view === null || view.metaParts.length === 0) {
      return '';
    }

    return (this.showModePicker() ? view.metaParts : [view.modeLabel, ...view.metaParts]).join(' · ');
  });
  /**
   * The page's only live region. It speaks once the numbers for a picked mode arrive, and for a
   * failure; the first load needs no announcement.
   */
  readonly announcement = computed(() => {
    const view = this.view();

    if (this.failed()) {
      return 'Win rates could not be loaded';
    }

    return this.choiceMade() && view !== null
      ? `Win rates updated ${view.scopeLabel}: ${view.matchesCountedLabel} counted`
      : '';
  });

  chooseMode(value: string): void {
    const mode = value as HeroStatsModeId;

    this.chosenMode.set(mode);
    this.pending.set(true);
    this.choiceMade.set(true);
    this.requested.next(mode);
  }
}
