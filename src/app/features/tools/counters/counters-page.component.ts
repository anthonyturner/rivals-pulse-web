import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { FilterOption, FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { HeroDataService } from '../../heroes/hero-data.service';
import { Hero, HeroRole } from '../../heroes/hero.model';
import { HeroMatchupsService } from '../../insights/hero-matchups.service';
import { HeroTileComponent } from '../../insights/hero-tile/hero-tile.component';
import { CounterEngineService, MultiThreatAnswer } from './counter-engine.service';
import { DIVE_THREATS } from './dive-threats';
import { JubileeCaseStudyComponent } from './jubilee-case-study/jubilee-case-study.component';

type RoleFilter = HeroRole | 'All';

const ROLES: readonly RoleFilter[] = ['All', 'Vanguard', 'Duelist', 'Strategist', 'Multi-Role'];

/** The most enemy heroes the planner takes at once; choosing another drops the oldest. */
const MAX_DIVE_THREATS = 4;

/** What the matchup records are doing: waiting, unreadable, readable but empty, or ready to show. */
type MatchupState = 'loading' | 'unavailable' | 'empty' | 'ready';

interface MatchupNotice {
  kind: 'loading' | 'error' | 'empty';
  heading: string | null;
  message: string;
}

@Component({
  selector: 'app-counters-page',
  imports: [
    FilterSelectComponent,
    HeroImageFallbackDirective,
    HeroTileComponent,
    JubileeCaseStudyComponent,
    NoticeComponent,
    PageHeaderComponent,
    RouterLink,
    StatePanelComponent,
  ],
  templateUrl: './counters-page.component.html',
  styleUrl: './counters-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountersPageComponent implements OnInit {
  private readonly counterEngine = inject(CounterEngineService);
  private readonly heroDataService = inject(HeroDataService);
  private readonly heroMatchupsService = inject(HeroMatchupsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  /** The roster: `undefined` until it has loaded. */
  private readonly heroes = signal<Hero[] | undefined>(undefined);

  /** RivalsPulse player matchups: `undefined` while loading, `null` when unreadable. */
  private readonly matchups = signal<HeroMatchups | null | undefined>(undefined);

  protected readonly roleOptions: readonly FilterOption[] = ROLES.map((role) => ({ value: role, label: role }));
  protected readonly maxDiveThreats = MAX_DIVE_THREATS;

  protected readonly selectedRole = signal<RoleFilter>('All');
  protected readonly selectedHeroId = signal('');
  protected readonly searchTerm = signal('');
  protected readonly selectedDiveThreatIds = signal<string[]>(['angela', 'black-cat', 'spider-man']);

  protected readonly heroesLoaded = computed(() => this.heroes() !== undefined);
  protected readonly minimumMatches = computed(() => this.matchups()?.minimumMatches);

  private readonly matchupState = computed<MatchupState>(() => {
    const matchups = this.matchups();

    if (matchups === undefined) {
      return 'loading';
    }

    if (matchups === null) {
      return 'unavailable';
    }

    return matchups.matchups.length === 0 ? 'empty' : 'ready';
  });

  /** The sentence that says the previous half-season stands in for the current one, or null when it does not. */
  protected readonly scopeNotice = computed(() => {
    const { halfSeason, inPlaceOf } = this.matchups() ?? {};

    return halfSeason && inPlaceOf ? halfSeasonFallbackNotice(inPlaceOf.label, halfSeason.label) : null;
  });

  protected readonly sourceLine = computed(() => {
    const halfSeason = this.matchups()?.halfSeason;
    const heroCount = this.heroes()?.length ?? 0;

    return [halfSeason && `Half-season: ${halfSeason.label}`, heroCount > 0 && `${heroCount} heroes`]
      .filter(Boolean)
      .join(' · ');
  });

  /** What to show in place of records while there are none to show, or null once there are. */
  protected readonly matchupNotice = computed<MatchupNotice | null>(() => {
    switch (this.matchupState()) {
      case 'loading':
        return { kind: 'loading', heading: null, message: 'Loading matchups…' };
      case 'unavailable':
        return {
          kind: 'error',
          heading: 'Matchups unavailable',
          message: 'RivalsPulse player matchups cannot be loaded right now. The hero list still works.',
        };
      case 'empty':
        return {
          kind: 'empty',
          heading: 'Not enough data yet',
          message: `No two heroes have faced each other in ${this.minimumMatches()} recorded matches yet. Matchups appear here as RivalsPulse players record more matches.`,
        };
      default:
        return null;
    }
  });

  private readonly filteredHeroes = computed(() =>
    this.counterEngine.filterHeroes(this.heroes() ?? [], this.selectedRole(), this.searchTerm()),
  );

  protected readonly pickerRows = computed(() =>
    this.filteredHeroes().map((hero) => ({ hero, detail: this.heroDetail(hero) })),
  );

  protected readonly pickerStatus = computed(() => `${this.pickerRows().length} heroes`);

  protected readonly pickerEmptyMessage = computed(() =>
    this.heroes()?.length === 0
      ? 'Heroes cannot be loaded right now.'
      : 'No heroes match. Try a different search or role.',
  );

  /** The chosen hero, or undefined while the roster loads or when the filters leave no hero to choose. */
  protected readonly selected = computed(() => {
    const hero = this.heroes()?.find((candidate) => candidate.id === this.selectedHeroId());

    return hero && { hero, detail: this.heroDetail(hero), query: { hero: hero.id } };
  });

  /** The two lists under the chosen hero: who has a winning record against it, and who it has one against. */
  protected readonly panels = computed(() => {
    const hero = this.selected()?.hero;
    const matchups = this.matchups();
    const roster = this.heroes() ?? [];

    if (!hero || !matchups) {
      return [];
    }

    return [
      {
        title: `Heroes that beat ${hero.name}`,
        cards: this.counterEngine.winningAgainst(hero, roster, matchups),
        empty: `No hero has a winning record against ${hero.name} in enough recorded matches yet.`,
      },
      {
        title: `Heroes ${hero.name} beats`,
        cards: this.counterEngine.winningFor(hero, roster, matchups),
        empty: `${hero.name} has no winning record against another hero in enough recorded matches yet.`,
      },
    ];
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

  protected readonly answerRows = computed(() => {
    const matchups = this.matchups();
    const threats = this.selectedThreats().map((chip) => chip.hero);
    const answers = matchups ? this.counterEngine.answersTo(threats, this.heroes() ?? [], matchups) : [];

    return answers.map((answer) => ({
      hero: answer.hero,
      covers: `${answer.coveredThreats.length}/${threats.length}`,
      detail: coverageLabel(answer),
    }));
  });

  ngOnInit(): void {
    this.heroMatchupsService
      .getHeroMatchups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((matchups) => this.matchups.set(matchups));

    this.heroDataService
      .getHeroes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((heroes) => {
        const requestedHeroId = this.route.snapshot.queryParamMap.get('hero') ?? '';
        const initialHero = heroes.find((hero) => hero.id === requestedHeroId) ?? heroes[0];

        this.heroes.set(heroes);
        this.selectedHeroId.set(initialHero?.id ?? '');
      });
  }

  protected selectRole(value: string): void {
    this.selectedRole.set(ROLES.find((role) => role === value) ?? 'All');
    this.selectFirstVisibleHero();
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
    this.selectFirstVisibleHero();
  }

  protected selectHero(heroId: string): void {
    this.selectedHeroId.set(heroId);
  }

  protected toggleDiveThreat(heroId: string): void {
    this.selectedDiveThreatIds.update((selectedIds) => {
      if (selectedIds.includes(heroId)) {
        return selectedIds.filter((selectedId) => selectedId !== heroId);
      }

      return selectedIds.length >= MAX_DIVE_THREATS ? [...selectedIds.slice(1), heroId] : [...selectedIds, heroId];
    });
  }

  private heroDetail(hero: Hero): string {
    return `${hero.role} · ${this.counterEngine.matchupCountLabel(hero, this.matchups())}`;
  }

  private selectFirstVisibleHero(): void {
    this.selectedHeroId.set(this.filteredHeroes()[0]?.id ?? '');
  }
}

function coverageLabel(answer: MultiThreatAnswer): string {
  return `Has a winning record against ${answer.coveredThreats.map((threat) => threat.name).join(', ')}`;
}
