import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { halfSeasonFallbackNotice } from '../../../shared/utilities/stat-labels';
import { HeroDataService } from '../../heroes/hero-data.service';
import { Hero, HeroRole } from '../../heroes/hero.model';
import { HeroMatchupsService } from '../../insights/hero-matchups.service';
import { CounterEngineService, MultiThreatAnswer } from './counter-engine.service';

type RoleFilter = HeroRole | 'All';

/** What the matchup records are doing: waiting, unreadable, readable but empty, or ready to show. */
type MatchupState = 'loading' | 'unavailable' | 'empty' | 'ready';

@Component({
  selector: 'app-counters-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './counters-page.component.html',
  styleUrl: './counters-page.component.css',
})
export class CountersPageComponent implements OnInit {
  private readonly counterEngine = inject(CounterEngineService);
  private readonly heroDataService = inject(HeroDataService);
  private readonly heroMatchupsService = inject(HeroMatchupsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly heroes = signal<Hero[]>([]);

  /** Rivals Pulse player matchups: `undefined` while loading, `null` when unreadable. */
  readonly matchups = signal<HeroMatchups | null | undefined>(undefined);

  readonly roles: RoleFilter[] = ['All', 'Vanguard', 'Duelist', 'Strategist', 'Multi-Role'];
  readonly selectedRole = signal<RoleFilter>('All');
  readonly selectedHeroId = signal('');
  readonly searchTerm = signal('');
  readonly heroCount = computed(() => this.heroes().length);
  readonly diveThreatOrder = [
    'angela',
    'black-cat',
    'spider-man',
    'psylocke',
    'black-panther',
    'iron-fist',
    'magik',
    'venom',
  ];
  readonly selectedDiveThreatIds = signal<string[]>(['angela', 'black-cat', 'spider-man']);

  readonly matchupState = computed<MatchupState>(() => {
    const matchups = this.matchups();

    if (matchups === undefined) {
      return 'loading';
    }

    if (matchups === null) {
      return 'unavailable';
    }

    return matchups.matchups.length === 0 ? 'empty' : 'ready';
  });

  /** The half-season the records come from, and the sentence that says so when it is the previous one. */
  readonly scope = computed(() => {
    const matchups = this.matchups();

    if (!matchups?.halfSeason) {
      return null;
    }

    return {
      label: matchups.halfSeason.label,
      notice: matchups.inPlaceOf
        ? halfSeasonFallbackNotice(matchups.inPlaceOf.label, matchups.halfSeason.label)
        : null,
    };
  });

  /** What to say in place of records while there are none to show, or null once there are. */
  readonly matchupNotice = computed<{ heading: string; message: string } | null>(() => {
    const matchups = this.matchups();

    switch (this.matchupState()) {
      case 'loading':
        return { heading: 'Loading', message: 'Loading Rivals Pulse player matchups...' };
      case 'unavailable':
        return {
          heading: 'Matchups unavailable',
          message: 'Rivals Pulse player matchups cannot be loaded right now. The rest of this page is not affected.',
        };
      case 'empty':
        return {
          heading: 'Not enough data yet',
          message: `No two heroes have faced each other in ${matchups?.minimumMatches} recorded matches yet. Matchups appear here as Rivals Pulse players record more matches.`,
        };
      default:
        return null;
    }
  });

  readonly diveThreatChoices = computed(() => {
    const heroById = new Map(this.heroes().map((hero) => [hero.id, hero]));

    return this.diveThreatOrder
      .map((heroId) => heroById.get(heroId))
      .filter((hero): hero is Hero => Boolean(hero));
  });

  readonly selectedDiveThreats = computed(() => {
    const selectedIds = new Set(this.selectedDiveThreatIds());

    return this.diveThreatChoices().filter((hero) => selectedIds.has(hero.id));
  });

  readonly multiThreatAnswers = computed<MultiThreatAnswer[]>(() => {
    const matchups = this.matchups();

    return matchups
      ? this.counterEngine.answersTo(this.selectedDiveThreats(), this.heroes(), matchups)
      : [];
  });

  readonly filteredHeroes = computed(() => {
    const role = this.selectedRole();
    const searchTerm = this.searchTerm().trim().toLowerCase();

    return this.counterEngine.filterHeroes(this.heroes(), role, searchTerm);
  });

  readonly selectedHero = computed(() => {
    const selected = this.heroes().find((hero) => hero.id === this.selectedHeroId());

    return selected ?? this.filteredHeroes()[0] ?? this.heroes()[0];
  });

  /** Heroes with a winning record against the selected hero. */
  readonly winningAgainstSelected = computed(() => {
    const selectedHero = this.selectedHero();
    const matchups = this.matchups();

    return selectedHero && matchups
      ? this.counterEngine.winningAgainst(selectedHero, this.heroes(), matchups)
      : [];
  });

  /** Heroes the selected hero has a winning record against. */
  readonly winningForSelected = computed(() => {
    const selectedHero = this.selectedHero();
    const matchups = this.matchups();

    return selectedHero && matchups
      ? this.counterEngine.winningFor(selectedHero, this.heroes(), matchups)
      : [];
  });

  ngOnInit(): void {
    this.heroMatchupsService
      .getHeroMatchups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((matchups) => this.matchups.set(matchups));

    this.heroDataService.getHeroes().subscribe((heroes) => {
      const requestedHeroId = this.route.snapshot.queryParamMap.get('hero') ?? '';
      const initialHero = heroes.find((hero) => hero.id === requestedHeroId) ?? heroes[0];

      this.heroes.set(heroes);
      this.selectedHeroId.set(initialHero?.id ?? '');
    });
  }

  selectRole(role: RoleFilter): void {
    this.selectedRole.set(role);
    this.selectedHeroId.set(this.filteredHeroes()[0]?.id ?? '');
  }

  selectHero(heroId: string): void {
    this.selectedHeroId.set(heroId);
  }

  toggleDiveThreat(heroId: string): void {
    this.selectedDiveThreatIds.update((selectedIds) => {
      if (selectedIds.includes(heroId)) {
        return selectedIds.filter((selectedId) => selectedId !== heroId);
      }

      return selectedIds.length >= 4 ? [...selectedIds.slice(1), heroId] : [...selectedIds, heroId];
    });
  }

  isDiveThreatSelected(heroId: string): boolean {
    return this.selectedDiveThreatIds().includes(heroId);
  }

  coverageLabel(answer: MultiThreatAnswer): string {
    const names = answer.coveredThreats.map((threat) => threat.name);

    return `Has a winning record against ${names.join(', ')}`;
  }

  threatInstruction(heroName: string): string {
    const instructions: Record<string, string> = {
      Angela:
        'Do not chase her flight path. Hold cover and peel tools, then focus her after she lands or commits Assassin’s Charge.',
      'Black Cat':
        'Track her staging angle, force her defensive relic or return dash, and punish the spot where she has to reappear.',
      'Spider-Man':
        'Call the web mark early. Bubble or heal the marked ally and layer control where his combo has to finish.',
      Psylocke:
        'Keep supports in mutual line of sight, reveal her approach with damage, and deny the isolated target she needs.',
      'Black Panther':
        'Stand inside a protected zone and interrupt his dash-reset rhythm instead of following him away from the team.',
      'Iron Fist':
        'Kite his defensive window, then focus him together once his sustain and gap close have been spent.',
      Magik:
        'Respect her portal timing, avoid feeding grouped cleave, and control the exit point when she enters the backline.',
      Venom:
        'Do not panic into his bonus health. Stabilize the landing, deny follow-up damage, then burn him on the exit.',
    };

    return instructions[heroName] ?? 'Protect the first target, deny the reset, and focus the committed diver together.';
  }

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.searchTerm.set(input.value);
    this.selectedHeroId.set(this.filteredHeroes()[0]?.id ?? '');
  }

  roleClass(role: HeroRole): string {
    return role.toLowerCase().replace(/\s+/g, '-');
  }

  matchupCountLabel(hero: Hero): string {
    return this.counterEngine.matchupCountLabel(hero, this.matchups());
  }
}
