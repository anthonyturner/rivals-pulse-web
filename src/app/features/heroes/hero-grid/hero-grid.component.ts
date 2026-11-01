import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, output } from '@angular/core';

import { Hero, HeroRole } from '../hero.model';

export type HeroRoleFilter = HeroRole | 'All';
export type HeroGridMode = 'rows' | 'thumbs';

interface HeroCard {
  id: string;
  name: string;
  summary: string;
  imageUrl: string;
  roleLabel: HeroRole;
  roleClass: string;
  archetype: string;
  label: string;
  selected: boolean;
  lazy: boolean;
}

/** Cards in the first two rows at the widest layout; images after them load lazily. */
const EAGER_CARD_COUNT = 20;

@Component({
  selector: 'app-hero-grid',
  templateUrl: './hero-grid.component.html',
  styleUrl: './hero-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroGridComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly heroes = input.required<Hero[]>();
  readonly roles = input.required<HeroRoleFilter[]>();
  readonly selectedRole = input.required<HeroRoleFilter>();
  readonly selectedHeroId = input.required<string>();
  readonly searchTerm = input.required<string>();
  readonly gridMode = input.required<HeroGridMode>();
  readonly loading = input(false);

  readonly roleSelected = output<HeroRoleFilter>();
  readonly searchChanged = output<string>();
  readonly gridModeSelected = output<HeroGridMode>();
  readonly heroSelected = output<string>();
  readonly filtersReset = output<void>();

  readonly placeholders = Array.from({ length: EAGER_CARD_COUNT }, (_, index) => index);

  readonly cards = computed<HeroCard[]>(() => {
    const filter = this.selectedRole();
    const selectedId = this.selectedHeroId();

    return this.heroes().map((hero, index) => {
      const roleLabel = filter !== 'All' && this.heroMatchesRole(hero, filter) ? filter : hero.role;
      const archetype =
        hero.gameplayArchetypes?.find((candidate) => candidate.role === roleLabel)?.label ??
        hero.gameplayArchetypes?.[0]?.label ??
        '';

      return {
        id: hero.id,
        name: hero.name,
        summary: hero.summary,
        imageUrl: hero.imageUrl,
        roleLabel,
        roleClass: roleLabel.toLowerCase(),
        archetype,
        label: `${hero.name}, ${roleLabel}`,
        selected: hero.id === selectedId,
        lazy: index >= EAGER_CARD_COUNT,
      };
    });
  });

  readonly countLabel = computed(() => {
    const count = this.heroes().length;

    return `${count} ${count === 1 ? 'hero' : 'heroes'}`;
  });

  readonly hasActiveFilters = computed(() => this.selectedRole() !== 'All' || this.searchTerm() !== '');

  /** Returns keyboard focus to a hero's card, scrolling it into view if needed. */
  focusHero(heroId: string): void {
    this.host.nativeElement.querySelector<HTMLElement>(`[data-hero-id="${CSS.escape(heroId)}"]`)?.focus();
  }

  updateSearch(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }

  private heroMatchesRole(hero: Hero, role: HeroRole): boolean {
    return hero.role === role || (hero.roleAbilityKits ?? []).some((kit) => kit.role === role);
  }
}
