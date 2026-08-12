import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CounterEngineService } from './counter-engine.service';
import { HeroDataService } from '../../heroes/hero-data.service';
import { Hero, HeroRole } from '../../heroes/hero.model';

type RoleFilter = HeroRole | 'All';

interface MultiThreatAnswer {
  hero: Hero;
  coveredThreats: Hero[];
}

@Component({
  selector: 'app-counters-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './counters-page.component.html',
  styleUrl: './counters-page.component.css',
})
export class CountersPageComponent implements OnInit {
  private readonly counterEngine = inject(CounterEngineService);
  private readonly heroDataService = inject(HeroDataService);
  private readonly route = inject(ActivatedRoute);
  private readonly heroes = signal<Hero[]>([]);

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
    const threats = this.selectedDiveThreats();

    if (!threats.length) {
      return [];
    }

    return this.heroes()
      .filter((candidate) => !threats.some((threat) => threat.id === candidate.id))
      .map((candidate) => ({
        hero: candidate,
        coveredThreats: threats.filter((threat) =>
          threat.counters.some(
            (counterName) => this.normalizeName(counterName) === this.normalizeName(candidate.name),
          ),
        ),
      }))
      .filter((answer) => answer.coveredThreats.length > 0)
      .sort(
        (a, b) =>
          b.coveredThreats.length - a.coveredThreats.length ||
          this.antiDiveRolePriority(a.hero.role) - this.antiDiveRolePriority(b.hero.role) ||
          a.hero.name.localeCompare(b.hero.name),
      )
      .slice(0, 6);
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

  readonly matchedCounterHeroes = computed(() => {
    const selectedHero = this.selectedHero();

    if (!selectedHero) {
      return [];
    }

    return this.counterEngine.matchedCounterHeroes(selectedHero, this.heroes());
  });

  readonly unmatchedCounters = computed(() => {
    const selectedHero = this.selectedHero();

    if (!selectedHero) {
      return [];
    }

    return this.counterEngine.unmatchedCounters(selectedHero, this.heroes());
  });

  readonly heroesCounteredBySelected = computed(() => {
    const selectedHero = this.selectedHero();

    if (!selectedHero) {
      return [];
    }

    return this.counterEngine.heroesCounteredBy(selectedHero, this.heroes());
  });

  readonly topCounteredHeroes = computed(() =>
    this.counterEngine.topCounteredHeroes(this.heroes()),
  );

  ngOnInit(): void {
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

    return `Answers ${names.join(', ')}`;
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

  counterCountLabel(hero: Hero): string {
    return `${hero.counters.length} counter${hero.counters.length === 1 ? '' : 's'}`;
  }

  counterSummary(hero: Hero): string {
    return this.counterEngine.counterSummary(hero, this.heroes());
  }

  counterReason(target: Hero, counterName: string): string {
    return this.counterEngine.counterReason(target, counterName, this.heroes());
  }

  private antiDiveRolePriority(role: HeroRole): number {
    return role === 'Vanguard' ? 0 : role === 'Duelist' ? 1 : 2;
  }

  private normalizeName(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
  }
}
