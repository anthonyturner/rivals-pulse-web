import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Hero, HeroRole } from '../hero.model';

export type HeroRoleFilter = HeroRole | 'All';
export type HeroGridMode = 'rows' | 'thumbs';

@Component({
  selector: 'app-hero-grid',
  imports: [CommonModule],
  templateUrl: './hero-grid.component.html',
  styleUrl: './hero-grid.component.css',
})
export class HeroGridComponent {
  @Input({ required: true }) heroes: Hero[] = [];
  @Input({ required: true }) roles: HeroRoleFilter[] = [];
  @Input({ required: true }) selectedRole: HeroRoleFilter = 'All';
  @Input({ required: true }) selectedHeroId = '';
  @Input({ required: true }) searchTerm = '';
  @Input({ required: true }) gridMode: HeroGridMode = 'thumbs';

  @Output() readonly roleSelected = new EventEmitter<HeroRoleFilter>();
  @Output() readonly searchChanged = new EventEmitter<string>();
  @Output() readonly gridModeSelected = new EventEmitter<HeroGridMode>();
  @Output() readonly heroSelected = new EventEmitter<string>();
  @Output() readonly filtersReset = new EventEmitter<void>();

  updateSearch(event: Event): void {
    this.searchChanged.emit((event.target as HTMLInputElement).value);
  }

  resetFilters(): void {
    this.filtersReset.emit();
  }

  heroRoleLabel(hero: Hero): HeroRole {
    return this.selectedRole !== 'All' && this.heroMatchesRole(hero, this.selectedRole)
      ? this.selectedRole
      : hero.role;
  }

  roleClass(role: HeroRole): string {
    return role.toLowerCase();
  }

  gameplayArchetype(hero: Hero): string {
    const displayedRole = this.heroRoleLabel(hero);

    return (
      hero.gameplayArchetypes?.find((archetype) => archetype.role === displayedRole)?.label ??
      hero.gameplayArchetypes?.[0]?.label ??
      ''
    );
  }

  private heroMatchesRole(hero: Hero, role: HeroRole): boolean {
    return hero.role === role || (hero.roleAbilityKits ?? []).some((kit) => kit.role === role);
  }
}
