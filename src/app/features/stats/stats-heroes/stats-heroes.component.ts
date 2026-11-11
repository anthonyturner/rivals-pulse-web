import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, map, Observable, skip, switchMap, tap } from 'rxjs';

import type { HeroStats, HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import { contentState, reportContentState } from '../../../core/seo/thin-content';
import { FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { DEFAULT_MODE_ID, heroStatsModeOptions, type ModeOption } from '../../../shared/utilities/play-modes';
import { HeroesTabComponent } from '../../community/heroes-tab/heroes-tab.component';
import { HeroDataService } from '../../heroes/hero-data.service';
import { CurrentHeroStatsService } from '../../insights/current-hero-stats.service';
import { seasonOptions, type SeasonOption } from '../../insights/half-season-view';
import { heroIdentities } from '../../insights/hero-identity';
import { HeroStatsService } from '../../insights/hero-stats.service';
import {
  heroStatsQuery,
  heroStatsScope,
  heroStatsView,
  sameHeroStatsScope,
  type HeroStatsScope,
  type HeroStatsViewId,
} from './hero-stats-request';
import { HeroTableComponent } from './hero-table/hero-table.component';
import { buildWinRatesView } from './hero-table/win-rates-view';
import { HeroTiersComponent } from './hero-tiers/hero-tiers.component';
import { buildTierListView } from './hero-tiers/tier-list-view';

interface Answer {
  scope: HeroStatsScope;
  /** Null when the request failed. */
  stats: HeroStats | null;
}

interface ViewLink {
  id: HeroStatsViewId;
  label: string;
  query: Record<string, string | null>;
}

const VIEW_LINKS: readonly ViewLink[] = [
  { id: 'table', label: 'Table', query: heroStatsQuery({ view: 'table' }) },
  { id: 'tiers', label: 'Tiers', query: heroStatsQuery({ view: 'tiers' }) },
];

/**
 * The hero numbers: the community's most picked and best-winning heroes with their per-minute
 * figures, then every hero's record as a table or as a tier list. The layout, half-season and mode
 * are in the address (`?view=tiers&season=10&mode=competitive`), so each can be linked and is
 * drawn by the server.
 */
@Component({
  selector: 'app-stats-heroes',
  imports: [
    FilterSelectComponent,
    HeroesTabComponent,
    HeroTableComponent,
    HeroTiersComponent,
    NoticeComponent,
    RouterLink,
    StatePanelComponent,
  ],
  templateUrl: './stats-heroes.component.html',
  styleUrl: './stats-heroes.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsHeroesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly currentHeroStats = inject(CurrentHeroStatsService);
  private readonly heroStats = inject(HeroStatsService);

  private readonly scope$ = this.route.queryParamMap.pipe(map(heroStatsScope), distinctUntilChanged(sameHeroStatsScope));

  protected readonly viewLinks = VIEW_LINKS;
  protected readonly layout = toSignal(this.route.queryParamMap.pipe(map(heroStatsView)), { initialValue: 'table' });
  private readonly scope = toSignal(this.scope$, { initialValue: heroStatsScope(this.route.snapshot.queryParamMap) });
  /** Kept from the last answer, so the pickers stay when a request for one half-season or mode fails. */
  private readonly seasons = signal<SeasonOption[]>([]);
  private readonly modes = signal<ModeOption[]>([]);
  /** True once the reader has chosen another half-season or mode, so the first load is not announced. */
  private readonly choiceMade = toSignal(
    this.scope$.pipe(
      skip(1),
      map(() => true),
    ),
    { initialValue: false },
  );
  // undefined while the first request runs.
  private readonly answer = toSignal(
    this.scope$.pipe(
      switchMap((scope) =>
        this.statsFor(scope).pipe(
          tap((stats) => this.rememberPickers(stats, scope)),
          map((stats): Answer => ({ scope, stats })),
        ),
      ),
    ),
  );
  private readonly roster = toSignal(inject(HeroDataService).getHeroes());
  private readonly identities = computed(() => heroIdentities(this.roster() ?? []));

  /** The answer to the scope now in the address; an older one is not shown under the new label. */
  private readonly current = computed(() => {
    const answer = this.answer();

    return answer !== undefined && sameHeroStatsScope(answer.scope, this.scope()) ? answer : undefined;
  });

  /** Names and portraits wait for the roster, so a hero is not drawn under a guessed name first. */
  protected readonly loading = computed(() => this.current() === undefined || this.roster() === undefined);
  protected readonly failed = computed(() => this.current()?.stats === null);
  private readonly stats = computed(() => (this.loading() ? null : (this.current()?.stats ?? null)));
  protected readonly tableView = computed(() => {
    const stats = this.stats();

    return stats !== null && this.layout() === 'table' ? buildWinRatesView(stats, this.identities()) : null;
  });
  protected readonly tierView = computed(() => {
    const stats = this.stats();

    return stats !== null && this.layout() === 'tiers' ? buildTierListView(stats, this.identities()) : null;
  });
  /** What both layouts share: the labels, notices and meta line the tab draws around either. */
  protected readonly shown = computed(() => this.tableView() ?? this.tierView());

  protected readonly seasonChoices = computed(() => this.seasons().map(({ id, label }) => ({ value: String(id), label })));
  protected readonly modeChoices = computed(() => this.modes().map(({ id, label }) => ({ value: id, label })));
  protected readonly selectedMode = computed(() => this.scope().mode);
  protected readonly selectedSeason = computed(() => {
    const id = this.scope().season ?? this.shown()?.season?.id;

    return id === undefined ? undefined : String(id);
  });
  /** Hidden until the first answer is in, so the pickers do not push the loading panel down when they appear. */
  private readonly pickersReady = computed(() => this.answer() !== undefined);
  protected readonly showSeasonPicker = computed(() => this.seasons().length > 1 && this.pickersReady());
  protected readonly showModePicker = computed(() => this.modes().length > 1 && this.pickersReady());
  /** With no picker to say which mode is counted, the meta line says it. */
  protected readonly meta = computed(() => {
    const shown = this.shown();

    if (shown === null || shown.metaParts.length === 0) {
      return '';
    }

    return (this.showModePicker() ? shown.metaParts : [shown.modeLabel, ...shown.metaParts]).join(' · ');
  });
  /** Spoken once the numbers for a picked half-season or mode arrive, and for a failure; the first load needs no announcement. */
  protected readonly announcement = computed(() => {
    const shown = this.shown();

    if (this.failed()) {
      return 'Hero stats could not be loaded';
    }

    return this.choiceMade() && shown !== null ? `Hero stats updated ${shown.scopeLabel}: ${shown.decidedMatchesLabel}` : '';
  });

  constructor() {
    reportContentState(() =>
      contentState(this.loading(), this.tableView()?.state === 'full' || this.tierView()?.state === 'ready'),
    );
  }

  /** The newest half-season is the plain address's own, so choosing it drops `season` and reuses the shared current numbers. */
  protected chooseSeason(value: string): void {
    const season = Number(value);

    this.choose(heroStatsQuery({ season: season === this.seasons()[0]?.id ? undefined : season }));
  }

  protected chooseMode(value: string): void {
    this.choose(heroStatsQuery({ mode: value as HeroStatsModeId }));
  }

  private choose(query: Record<string, string | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: query, queryParamsHandling: 'merge' });
  }

  /** The default cut comes from the shared current stats; a half-season or mode the reader picked is asked for itself. */
  private statsFor({ season, mode }: HeroStatsScope): Observable<HeroStats | null> {
    return season === undefined && mode === DEFAULT_MODE_ID
      ? this.currentHeroStats.getHeroStats()
      : this.heroStats.getHeroStats(season, mode);
  }

  private rememberPickers(stats: HeroStats | null, { mode }: HeroStatsScope): void {
    if (stats === null) {
      return;
    }

    if (stats.halfSeasons.length > 0) {
      this.seasons.set(seasonOptions(stats.halfSeasons));
    }

    this.modes.set(heroStatsModeOptions(stats, mode));
  }
}
