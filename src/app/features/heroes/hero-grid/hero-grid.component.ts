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
export type HeroGridLayout = 'grid' | 'roster';

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
  /**
   * `roster` is the compact hero list that goes with a hero's detail, with no Rows/Thumbs choice. The stylesheet
   * draws it as a column beside the detail from 920px and as a one-row portrait strip with no controls below
   * that, so server and browser output are the same at every width.
   */
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
      if (this.layout() === 'roster' && !this.loading()) {
        this.selectedHeroId();
        this.revealSelectedCard();
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

  /**
   * Scrolls the roster's own list, never the page, so the chosen hero is in view on a direct load. The list
   * scrolls down in the column and sideways in the strip; an axis that does not scroll is left alone.
   */
  private revealSelectedCard(): void {
    const list = this.host.nativeElement.querySelector<HTMLElement>('.hero-grid');
    const card = list?.querySelector<HTMLElement>('.hero-card.selected');

    if (!list || !card) {
      return;
    }

    const listBox = list.getBoundingClientRect();
    const cardBox = card.getBoundingClientRect();

    if (cardBox.top < listBox.top || cardBox.bottom > listBox.bottom) {
      list.scrollTop += cardBox.top - listBox.top - (list.clientHeight - cardBox.height) / 2;
    }

    if (cardBox.left < listBox.left || cardBox.right > listBox.right) {
      list.scrollLeft += cardBox.left - listBox.left - (list.clientWidth - cardBox.width) / 2;
    }
  }

  private heroMatchesRole(hero: Hero, role: HeroRole): boolean {
    return hero.role === role || (hero.roleAbilityKits ?? []).some((kit) => kit.role === role);
  }
}
