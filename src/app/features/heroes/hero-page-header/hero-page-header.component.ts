import { Component, Input } from '@angular/core';

import { HeroRoleFilter } from '../hero-grid/hero-grid.component';
import { Hero } from '../hero.model';

@Component({
  selector: 'app-hero-page-header',
  templateUrl: './hero-page-header.component.html',
  styleUrl: './hero-page-header.component.css',
})
export class HeroPageHeaderComponent {
  @Input() hero?: Hero;
  @Input({ required: true }) visibleCount = 0;
  @Input({ required: true }) selectedRole: HeroRoleFilter = 'All';

  readonly difficultyPips = [1, 2, 3, 4, 5];

  get countLabel(): string {
    return this.selectedRole === 'All' ? 'heroes' : this.selectedRole;
  }
}
