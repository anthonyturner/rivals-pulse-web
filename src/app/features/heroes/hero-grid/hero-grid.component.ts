import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Hero, HeroRole } from '../hero.model';

export type HeroRoleFilter = HeroRole | 'All';
export type HeroGridMode = 'rows' | 'thumbs';
export type HeroGridLayout = 'grid' | 'column';

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
  imports: [RouterLink],
  templateUrl: './hero-grid.component.html',
  styleUrl: './hero-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.layout]': 'layout()' },
})
export class HeroGridComponent {
  readonly heroes = input.required<Hero[]>();
  readonly roles = input.required<HeroRoleFilter[]>();
  readonly selectedRole = input.required<HeroRoleFilter>();
  readonly selectedHeroId = input.required<string>();
  readonly searchTerm = input.required<string>();
  readonly gridMode = input.required<HeroGridMode>();
  readonly loading = input(false);
  /** `column` is the compact roster beside a hero's detail: no Rows/Thumbs choice, and the list scrolls on its own. */
  readonly layout = input<HeroGridLayout>('grid');

  readonly roleSelected = output<HeroRoleFilter>();
  readonly searchChanged = output<string>();
  readonly gridModeSelected = output<HeroGridMode>();
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

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Reads only the layout, the loading flag and the chosen hero, so typing in the search box does not
    // move the list under the visitor; the roster arriving or another hero being chosen does.
    afterRenderEffect(() => {
      if (this.layout() === 'column' && !this.loading()) {
        this.selectedHeroId();
        this.revealSelectedRow();
      }
    });
  }

  readonly isGrid = computed(() => this.layout() === 'grid');
  readonly showsRows = computed(() => this.isGrid() && this.gridMode() === 'rows');

  readonly countLabel = computed(() => {
    const count = this.heroes().length;

    return `${count} ${count === 1 ? 'hero' : 'heroes'}`;
  });

  readonly hasActiveFilters = computed(() => this.selectedRole() !== 'All' || this.searchTerm() !== '');

  updateSearch(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }

  /** Scrolls the column's own list, never the page, so the chosen hero's row is in view on a direct load. */
  private revealSelectedRow(): void {
    const list = this.host.nativeElement.querySelector<HTMLElement>('.hero-grid');
    const row = list?.querySelector<HTMLElement>('.hero-card.selected');

    if (!list || !row) {
      return;
    }

    const listBox = list.getBoundingClientRect();
    const rowBox = row.getBoundingClientRect();

    if (rowBox.top < listBox.top || rowBox.bottom > listBox.bottom) {
      list.scrollTop += rowBox.top - listBox.top - (list.clientHeight - rowBox.height) / 2;
    }
  }

  private heroMatchesRole(hero: Hero, role: HeroRole): boolean {
    return hero.role === role || (hero.roleAbilityKits ?? []).some((kit) => kit.role === role);
  }
}
