import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';

import {
  computeHeroBuildProfile,
  heroBuildTypes,
  HeroBuildType,
} from '../../heroes/hero-build-profile';
import { HeroDataService } from '../../heroes/hero-data.service';
import { Hero, HeroRole } from '../../heroes/hero.model';
import { TeamCompositionEngineService } from './team-composition-engine.service';

@Component({
  selector: 'app-team-builder-page',
  imports: [CommonModule],
  templateUrl: './team-builder-page.component.html',
  styleUrl: './team-builder-page.component.css',
})
export class TeamBuilderPageComponent implements OnInit {
  private readonly teamCompositionEngine = inject(TeamCompositionEngineService);
  private readonly heroDataService = inject(HeroDataService);
  private readonly heroes = signal<Hero[]>([]);
  readonly teamSlots = signal<(Hero | undefined)[]>(Array.from({ length: 6 }));
  readonly draggedHeroId = signal('');
  readonly selectedHeroId = signal('');

  readonly buildSignals = this.teamCompositionEngine.buildSignals;
  readonly buildTypes = heroBuildTypes();

  readonly selectedHeroes = computed(() => this.teamSlots().filter((hero): hero is Hero => Boolean(hero)));

  readonly availableHeroes = computed(() => {
    const selectedIds = new Set(this.selectedHeroes().map((hero) => hero.id));

    return this.heroes().filter((hero) => !selectedIds.has(hero.id));
  });

  readonly selectedDraftHero = computed(() =>
    this.heroes().find((hero) => hero.id === this.selectedHeroId()),
  );

  readonly compSummary = computed(() => this.teamCompositionEngine.analyzeTeam(this.selectedHeroes()));

  ngOnInit(): void {
    this.heroDataService.getHeroes().subscribe((heroes) => {
      this.heroes.set(heroes.map((hero) => ({
        ...hero,
        buildProfile: hero.buildProfile ?? computeHeroBuildProfile(hero),
      })));
    });
  }

  startHeroDrag(hero: Hero): void {
    this.draggedHeroId.set(hero.id);
    this.selectedHeroId.set(hero.id);
  }

  allowDrop(event: DragEvent): void {
    event.preventDefault();
  }

  dropHero(slotIndex: number, event: DragEvent): void {
    event.preventDefault();
    const heroId = this.draggedHeroId();
    const hero = this.heroes().find((item) => item.id === heroId);

    if (!hero) {
      return;
    }

    this.placeHero(hero, slotIndex);
    this.draggedHeroId.set('');
    this.selectedHeroId.set('');
  }

  selectDraftHero(hero: Hero): void {
    this.selectedHeroId.set(hero.id);
  }

  placeSelectedHero(slotIndex: number): void {
    const selectedHero = this.selectedDraftHero();

    if (selectedHero) {
      this.placeHero(selectedHero, slotIndex);
      this.selectedHeroId.set('');
    }
  }

  removeHero(slotIndex: number): void {
    this.teamSlots.update((slots) => slots.map((slot, index) => index === slotIndex ? undefined : slot));
  }

  clearTeam(): void {
    this.teamSlots.set(Array.from({ length: 6 }));
    this.selectedHeroId.set('');
  }

  roleClass(role: HeroRole): string {
    return role.toLowerCase().replace(/\s+/g, '-');
  }

  heroBuildValue(hero: Hero, type: HeroBuildType): number {
    return this.teamCompositionEngine.heroBuildValue(hero, type);
  }

  scoreTone(value: number, max = 10): string {
    const ratio = max > 0 ? value / max : 0;

    if (ratio >= 0.7) {
      return 'score-high';
    }

    if (ratio >= 0.4) {
      return 'score-mid';
    }

    return 'score-low';
  }

  private placeHero(hero: Hero, slotIndex: number): void {
    this.teamSlots.update((slots) => {
      const withoutDuplicate = slots.map((slot) => slot?.id === hero.id ? undefined : slot);

      return withoutDuplicate.map((slot, index) => index === slotIndex ? hero : slot);
    });
  }

}
