import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { HeroDataService } from '../../heroes/hero-data.service';
import { Hero } from '../../heroes/hero.model';
import { CurrentHeroMatchupsService } from '../../insights/current-hero-matchups.service';
import { counterRuleNote } from '../../insights/hero-matchup-records';
import { HeroTileComponent } from '../../insights/hero-tile/hero-tile.component';
import { matchupNotice } from '../../insights/matchup-notice';
import { answersTo, MultiThreatAnswer, noAnswerMessage } from './dive-answers';
import { DEFAULT_DIVE_THREAT_IDS, DIVE_THREATS } from './dive-threats';
import { JubileeCaseStudyComponent } from './jubilee-case-study/jubilee-case-study.component';

/** The most enemy heroes the planner takes at once; choosing another drops the oldest. */
const MAX_DIVE_THREATS = 4;

@Component({
  selector: 'app-dive-planner-page',
  imports: [
    HeroImageFallbackDirective,
    HeroTileComponent,
    JubileeCaseStudyComponent,
    NoticeComponent,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
  ],
  templateUrl: './dive-planner-page.component.html',
  styleUrl: './dive-planner-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DivePlannerPageComponent implements OnInit {
  private readonly heroDataService = inject(HeroDataService);
  private readonly currentHeroMatchups = inject(CurrentHeroMatchupsService);
  private readonly destroyRef = inject(DestroyRef);

  /** The roster: `undefined` until it has loaded. */
  private readonly heroes = signal<Hero[] | undefined>(undefined);

  /** RivalsPulse player matchups: `undefined` while loading, `null` when unreadable. */
  private readonly matchups = signal<HeroMatchups | null | undefined>(undefined);

  protected readonly maxDiveThreats = MAX_DIVE_THREATS;
  protected readonly selectedDiveThreatIds = signal<string[]>([...DEFAULT_DIVE_THREAT_IDS]);

  protected readonly heroesLoaded = computed(() => this.heroes() !== undefined);
  protected readonly notice = computed(() => matchupNotice(this.matchups(), 'The threat chips still work.'));

  protected readonly halfSeasonLine = computed(() => {
    const halfSeason = this.matchups()?.halfSeason;

    return halfSeason ? `Half-season: ${halfSeason.label}` : null;
  });

  /** The sentence that says the previous half-season stands in for the current one, or null when it does not. */
  protected readonly scopeNotice = computed(() => {
    const { halfSeason, inPlaceOf } = this.matchups() ?? {};

    return halfSeason && inPlaceOf ? halfSeasonFallbackNotice(inPlaceOf.label, halfSeason.label) : null;
  });

  protected readonly threatChips = computed(() => {
    const heroById = new Map((this.heroes() ?? []).map((hero) => [hero.id, hero]));
    const chosen = new Set(this.selectedDiveThreatIds());

    return DIVE_THREATS.flatMap(({ id, instruction }) => {
      const hero = heroById.get(id);

      return hero ? [{ hero, instruction, pressed: chosen.has(id) }] : [];
    });
  });

  protected readonly selectedThreats = computed(() => this.threatChips().filter((chip) => chip.pressed));

  protected readonly chosenLabel = computed(() => `${this.selectedThreats().length} of ${MAX_DIVE_THREATS} chosen`);

  protected readonly answerRows = computed(() => {
    const matchups = this.matchups();
    const threats = this.selectedThreats().map((chip) => chip.hero);
    const answers = matchups ? answersTo(threats, this.heroes() ?? [], matchups) : [];

    return answers.map((answer) => ({
      hero: answer.hero,
      query: { hero: answer.hero.id },
      covers: `${answer.coveredThreats.length}/${threats.length}`,
      detail: coverageLabel(answer),
    }));
  });

  protected readonly ruleNote = computed(() => {
    const matchups = this.matchups();

    return matchups ? counterRuleNote(matchups.minimumMatches) : '';
  });

  protected readonly noAnswerMessage = computed(() => {
    const matchups = this.matchups();

    return matchups ? noAnswerMessage(this.selectedThreats().map((chip) => chip.hero), matchups) : '';
  });

  /** The page's one live region: the count of chosen threats and answers, or why there are no answers. */
  protected readonly announcement = computed(() => {
    const notice = this.notice();

    if (notice?.kind === 'error') {
      return notice.message;
    }

    if (notice !== null || this.selectedThreats().length === 0) {
      return this.chosenLabel();
    }

    return `${this.chosenLabel()}. ${countLabel(this.answerRows().length, 'hero', 'heroes')} that do better than usual.`;
  });

  ngOnInit(): void {
    this.currentHeroMatchups
      .getHeroMatchups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((matchups) => this.matchups.set(matchups));

    this.heroDataService
      .getHeroes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((heroes) => this.heroes.set(heroes));
  }

  protected toggleDiveThreat(heroId: string): void {
    this.selectedDiveThreatIds.update((selectedIds) => {
      if (selectedIds.includes(heroId)) {
        return selectedIds.filter((selectedId) => selectedId !== heroId);
      }

      return selectedIds.length >= MAX_DIVE_THREATS ? [...selectedIds.slice(1), heroId] : [...selectedIds, heroId];
    });
  }
}

function coverageLabel(answer: MultiThreatAnswer): string {
  return `Does better than usual against ${answer.coveredThreats.map((threat) => threat.name).join(', ')}`;
}
