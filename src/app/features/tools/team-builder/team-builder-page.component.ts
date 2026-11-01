import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { HeroDataService } from '../../heroes/hero-data.service';
import { Hero } from '../../heroes/hero.model';
import { HeroTileComponent } from '../../insights/hero-tile/hero-tile.component';
import { TeamCompositionEngineService } from './team-composition-engine.service';

const TEAM_SIZE = 6;

/** A hero scores up to 10 on each build signal, so a full team's total tops out at 60. */
const MAX_SIGNAL = 10 * TEAM_SIZE;

const removeLabel = (hero: Hero): string => `Remove ${hero.name} from team`;

@Component({
  selector: 'app-team-builder-page',
  imports: [HeroTileComponent, NoticeComponent, StatePanelComponent],
  templateUrl: './team-builder-page.component.html',
  styleUrl: './team-builder-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamBuilderPageComponent implements OnInit {
  private readonly engine = inject(TeamCompositionEngineService);
  private readonly heroDataService = inject(HeroDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly teamHeading = viewChild.required<ElementRef<HTMLElement>>('teamHeading');
  private readonly removeButtons = viewChildren<ElementRef<HTMLButtonElement>>('removeButton');

  /** The roster: `undefined` until it has loaded, empty when it could not be loaded. */
  private readonly heroes = signal<Hero[] | undefined>(undefined);

  /** One entry per player slot; a slot holds a hero or is empty. */
  private readonly team = signal<(Hero | undefined)[]>(Array.from({ length: TEAM_SIZE }));

  protected readonly announcement = signal('');
  protected readonly signalMax = MAX_SIGNAL;

  private readonly chosen = computed(() => this.team().filter((hero): hero is Hero => hero !== undefined));
  protected readonly isEmpty = computed(() => this.chosen().length === 0);
  protected readonly isFull = computed(() => this.chosen().length === TEAM_SIZE);
  protected readonly chosenLabel = computed(() => `${this.chosen().length} of ${TEAM_SIZE} chosen`);

  protected readonly slots = computed(() =>
    this.team().map((hero, index) => ({
      hero,
      caption: `P${index + 1} · ${hero?.role ?? 'Empty'}`,
      removeLabel: hero && removeLabel(hero),
    })),
  );

  protected readonly poolState = computed(() => {
    const heroes = this.heroes();

    if (heroes === undefined) {
      return 'loading';
    }

    return heroes.length === 0 ? 'error' : 'ready';
  });

  protected readonly pool = computed(() => {
    const chosenIds = new Set(this.chosen().map((hero) => hero.id));
    const full = this.isFull();

    return (this.heroes() ?? []).map((hero) => {
      const picked = chosenIds.has(hero.id);

      return {
        hero,
        picked,
        disabled: full && !picked,
        label: picked ? removeLabel(hero) : `Add ${hero.name}, ${hero.role} to team`,
      };
    });
  });

  /** The reading of the team, or null while it is empty. */
  protected readonly summary = computed(() => (this.isEmpty() ? null : this.engine.analyzeTeam(this.chosen())));

  protected readonly signalRows = computed(() => {
    const scores = this.summary()?.buildScores;

    return scores
      ? this.engine.buildSignals.map(({ type }) => ({
          type,
          value: scores[type],
          label: `${type} ${scores[type]} of ${MAX_SIGNAL}`,
        }))
      : [];
  });

  ngOnInit(): void {
    this.loadHeroes();
  }

  protected reload(): void {
    this.heroes.set(undefined);
    this.loadHeroes();
  }

  /** Adds the hero to the first empty slot, or takes it out of the team when it is already in. */
  protected toggleHero(hero: Hero): void {
    const taken = this.team().findIndex((member) => member?.id === hero.id);
    const empty = this.team().indexOf(undefined);

    if (taken >= 0) {
      this.vacate(taken);
    } else if (empty >= 0) {
      this.place(hero, empty);
    }
  }

  /** Takes a hero out of a slot, then puts focus on the nearest remaining remove button, or the heading. */
  protected removeFromSlot(index: number): void {
    this.vacate(index);
    this.focusAfterRemoving(index);
  }

  protected clearTeam(): void {
    this.team.set(Array.from({ length: TEAM_SIZE }));
    this.announcement.set('Team cleared.');
    this.teamHeading().nativeElement.focus();
  }

  protected startHeroDrag(event: DragEvent, hero: Hero): void {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', hero.id);
    }
  }

  protected allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  protected dropHero(event: DragEvent, slotIndex: number): void {
    event.preventDefault();
    const heroId = event.dataTransfer?.getData('text/plain');
    const hero = this.heroes()?.find((candidate) => candidate.id === heroId);

    if (hero) {
      this.place(hero, slotIndex);
    }
  }

  private loadHeroes(): void {
    this.heroDataService
      .getHeroes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((heroes) => this.heroes.set(heroes));
  }

  /** Puts the hero in the slot, moving it there if it was already in the team. */
  private place(hero: Hero, slotIndex: number): void {
    this.team.update((slots) =>
      slots.map((slot, index) => (index === slotIndex ? hero : slot?.id === hero.id ? undefined : slot)),
    );
    this.announcement.set(
      `${hero.name} added to P${slotIndex + 1}. ${this.chosenLabel()}.${this.isFull() ? ' Team is full. Remove a hero to add another.' : ''}`,
    );
  }

  private vacate(slotIndex: number): void {
    const hero = this.team()[slotIndex];

    this.team.update((slots) => slots.map((slot, index) => (index === slotIndex ? undefined : slot)));
    if (hero) {
      this.announcement.set(`${hero.name} removed. ${this.chosenLabel()}.`);
    }
  }

  private focusAfterRemoving(removedIndex: number): void {
    const filled = this.team().flatMap((hero, index) => (hero ? [index] : []));
    const nextFilled = filled.find((index) => index > removedIndex) ?? filled.at(-1);

    afterNextRender(
      () => {
        const target = nextFilled === undefined ? undefined : this.removeButtons()[filled.indexOf(nextFilled)];

        (target ?? this.teamHeading()).nativeElement.focus();
      },
      { injector: this.injector },
    );
  }
}
