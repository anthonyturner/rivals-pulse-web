import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { FilterOption, FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';
import { countLabel, halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { HeroDataService } from '../../heroes/hero-data.service';
import { Hero, HeroRole } from '../../heroes/hero.model';
import { CurrentHeroMatchupsService } from '../../insights/current-hero-matchups.service';
import { HeroTileComponent } from '../../insights/hero-tile/hero-tile.component';
import { counterRuleNote, noCounterMessage } from '../../insights/hero-matchup-records';
import { matchupNotice } from '../../insights/matchup-notice';
import { CounterEngineService } from './counter-engine.service';

type RoleFilter = HeroRole | 'All';

const ROLES: readonly RoleFilter[] = ['All', 'Vanguard', 'Duelist', 'Strategist', 'Multi-Role'];

@Component({
  selector: 'app-counters-page',
  imports: [
    FilterSelectComponent,
    HeroImageFallbackDirective,
    HeroTileComponent,
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
  private readonly currentHeroMatchups = inject(CurrentHeroMatchupsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly resultHeading = viewChild<ElementRef<HTMLElement>>('resultHeading');

  /** The roster: `undefined` until it has loaded. */
  private readonly heroes = signal<Hero[] | undefined>(undefined);

  /** RivalsPulse player matchups: `undefined` while loading, `null` when unreadable. */
  private readonly matchups = signal<HeroMatchups | null | undefined>(undefined);

  protected readonly roleOptions: readonly FilterOption[] = ROLES.map((role) => ({ value: role, label: role }));

  protected readonly selectedRole = signal<RoleFilter>('All');
  protected readonly selectedHeroId = signal('');
  protected readonly searchTerm = signal('');

  protected readonly heroesLoaded = computed(() => this.heroes() !== undefined);
  protected readonly ruleNote = computed(() => {
    const matchups = this.matchups();

    return matchups ? counterRuleNote(matchups.minimumMatches) : '';
  });

  /** The sentence that says the previous half-season stands in for the current one, or null when it does not. */
  protected readonly scopeNotice = computed(() => {
    const { halfSeason, inPlaceOf } = this.matchups() ?? {};

    return halfSeason && inPlaceOf ? halfSeasonFallbackNotice(inPlaceOf.label, halfSeason.label) : null;
  });

  protected readonly sourceLine = computed(() => {
    const halfSeason = this.matchups()?.halfSeason;
    const heroCount = this.heroes()?.length ?? 0;

    return [halfSeason && `Half-season: ${halfSeason.label}`, heroCount > 0 && countLabel(heroCount, 'hero', 'heroes')]
      .filter(Boolean)
      .join(' · ');
  });

  protected readonly matchupNotice = computed(() => matchupNotice(this.matchups(), 'The hero list still works.'));

  private readonly filteredHeroes = computed(() =>
    this.counterEngine.filterHeroes(this.heroes() ?? [], this.selectedRole(), this.searchTerm()),
  );

  protected readonly pickerRows = computed(() =>
    this.filteredHeroes().map((hero) => ({ hero, detail: this.heroDetail(hero) })),
  );

  protected readonly pickerEmptyMessage = computed(() =>
    this.heroes()?.length === 0
      ? 'Heroes cannot be loaded right now.'
      : 'No heroes match. Try a different search or role.',
  );

  /** The chosen hero, or undefined while the roster loads or when the filters leave no hero to choose. */
  protected readonly selected = computed(() => {
    const hero = this.heroes()?.find((candidate) => candidate.id === this.selectedHeroId());

    return hero && { hero, detail: this.heroDetail(hero) };
  });

  /** The two lists under the chosen hero: who does better than usual against it, and whom it does better than usual against. */
  protected readonly panels = computed(() => {
    const hero = this.selected()?.hero;
    const matchups = this.matchups();
    const roster = this.heroes() ?? [];

    if (!hero || !matchups) {
      return [];
    }

    return [
      {
        key: 'against',
        title: `Heroes that do better than usual against ${hero.name}`,
        cards: this.counterEngine.winningAgainst(hero, roster, matchups),
        empty: noCounterMessage(matchups, hero.id, hero.name, 'against'),
      },
      {
        key: 'for',
        title: `Heroes ${hero.name} does better than usual against`,
        cards: this.counterEngine.winningFor(hero, roster, matchups),
        empty: noCounterMessage(matchups, hero.id, hero.name, 'for'),
      },
    ];
  });

  /** The page's one live region: the filtered count, the hero now shown, and a failure to read the matchups. */
  protected readonly announcement = computed(() => {
    const notice = this.matchupNotice();

    return [
      this.heroesLoaded() && countLabel(this.pickerRows().length, 'hero', 'heroes'),
      this.selected() && `Showing ${this.selected()?.hero.name}`,
      notice?.kind === 'error' && notice.message,
    ]
      .filter(Boolean)
      .join('. ');
  });

  ngOnInit(): void {
    this.currentHeroMatchups
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

  /** Shows a hero picked from a card. The card is replaced, so focus moves to the new heading. */
  protected pivotTo(heroId: string): void {
    this.selectHero(heroId);
    this.resultHeading()?.nativeElement.focus();
  }

  private heroDetail(hero: Hero): string {
    return `${hero.role} · ${this.counterEngine.matchupCountLabel(hero, this.matchups())}`;
  }

  private selectFirstVisibleHero(): void {
    this.selectedHeroId.set(this.filteredHeroes()[0]?.id ?? '');
  }
}
