import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BehaviorSubject, forkJoin, switchMap, tap } from 'rxjs';

import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
import type { HeroSynergies } from '../../../../contracts/hero-synergies.model';
import { contentState, reportContentState } from '../../../core/seo/thin-content';
import { FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';
import { heroStatsModeOptions, type ModeOption } from '../../../shared/utilities/play-modes';
import { HeroDataService } from '../../heroes/hero-data.service';
import { seasonOptions, type SeasonOption } from '../half-season-view';
import { heroIdentities } from '../hero-identity';
import { HeroSynergiesService } from '../hero-synergies.service';
import { TeamLineupsService } from '../team-lineups.service';
import { TripleSupportTriosService } from '../triple-support-trios.service';
import { buildTeamCompsView, hasTeamCompsData } from './team-comps-view';

/** The mode the page opens on: team comps are a ranked-play question, and Competitive is where it is played. */
const DEFAULT_TEAM_COMPS_MODE: HeroStatsModeId = 'competitive';

interface TeamCompsRequest {
  halfSeason: number | undefined;
  mode: HeroStatsModeId;
}

@Component({
  selector: 'app-team-comps-page',
  imports: [
    FilterSelectComponent,
    HeroImageFallbackDirective,
    NoticeComponent,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './team-comps-page.component.html',
  styleUrls: ['../insight-page.css', './team-comps-page.component.css'],
})
export class TeamCompsPageComponent {
  private readonly synergiesService = inject(HeroSynergiesService);
  private readonly triosService = inject(TripleSupportTriosService);
  private readonly lineupsService = inject(TeamLineupsService);
  private readonly chosenSeason = signal<number | undefined>(undefined);
  private readonly chosenMode = signal<HeroStatsModeId>(DEFAULT_TEAM_COMPS_MODE);
  /** True from choosing another half-season or mode until its numbers arrive, so the last one's are not shown under the new label. */
  private readonly pending = signal(false);
  private readonly choiceMade = signal(false);
  /** Kept from the last answer, so the pickers stay when a request for one half-season or mode fails. */
  private readonly seasons = signal<SeasonOption[]>([]);
  private readonly modes = signal<ModeOption[]>([]);
  private readonly requested = new BehaviorSubject<TeamCompsRequest>({
    halfSeason: undefined,
    mode: DEFAULT_TEAM_COMPS_MODE,
  });
  // undefined while the first request runs. Each part is null once its request has failed.
  private readonly answers = toSignal(
    this.requested.pipe(
      switchMap(({ halfSeason, mode }) =>
        forkJoin({
          synergies: this.synergiesService.getHeroSynergies(halfSeason, mode),
          trios: this.triosService.getTripleSupportTrios(halfSeason, mode),
          lineups: this.lineupsService.getTeamLineups(halfSeason, mode),
        }).pipe(
          tap(({ synergies }) => {
            this.rememberPickers(synergies);
            this.pending.set(false);
          }),
        ),
      ),
    ),
  );
  private readonly roster = toSignal(inject(HeroDataService).getHeroRoster());

  /** Names, portraits and roles wait for the roster: without it no pair could be filed under a role. */
  readonly loading = computed(() => this.answers() === undefined || this.roster() === undefined || this.pending());
  /** The duos carry the page; the triple supports or the line-ups failing alone is said in their own section. */
  readonly failed = computed(
    () => (this.answers() !== undefined && this.answers()?.synergies === null && !this.pending()) || this.roster() === null,
  );
  readonly view = computed(() => {
    const answers = this.answers();
    const roster = this.roster();

    return answers?.synergies && roster && !this.pending()
      ? buildTeamCompsView(answers.synergies, answers.trios, answers.lineups, heroIdentities(roster))
      : null;
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
  /** With no picker to say which mode is counted, the toolbar line says it. */
  readonly meta = computed(() => {
    const view = this.view();

    if (view === null) {
      return '';
    }

    return (this.showModePicker() ? view.metaParts : [view.modeLabel, ...view.metaParts]).join(' · ');
  });
  /** Spoken once the numbers for a picked mode or half-season arrive; empty on the first load, which needs no announcement. */
  readonly announcement = computed(() => {
    const view = this.view();

    return this.choiceMade() && view !== null ? `Team comps updated ${view.scopeLabel}` : '';
  });

  constructor() {
    reportContentState(() => {
      const view = this.view();

      return contentState(this.loading(), view !== null && hasTeamCompsData(view));
    });
  }

  chooseSeason(value: string): void {
    this.request(Number(value), this.chosenMode());
  }

  chooseMode(value: string): void {
    this.request(this.chosenSeason(), value as HeroStatsModeId);
  }

  private request(halfSeason: number | undefined, mode: HeroStatsModeId): void {
    this.chosenSeason.set(halfSeason);
    this.chosenMode.set(mode);
    this.pending.set(true);
    this.choiceMade.set(true);
    this.requested.next({ halfSeason, mode });
  }

  private rememberPickers(synergies: HeroSynergies | null): void {
    if (synergies === null) {
      return;
    }

    if (synergies.halfSeasons && synergies.halfSeasons.length > 0) {
      this.seasons.set(seasonOptions(synergies.halfSeasons));
    }

    this.modes.set(heroStatsModeOptions(synergies, this.chosenMode()));
  }
}
