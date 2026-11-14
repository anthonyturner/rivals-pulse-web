import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { Hero } from '../hero.model';
import type { HeroesPageComponent } from '../heroes-page.component';

@Component({
  selector: 'app-hero-role-switcher',
  imports: [CommonModule],
  templateUrl: './hero-role-switcher.component.html',
  styleUrl: './hero-role-switcher.component.css',
})
export class HeroRoleSwitcherComponent {
  @Input({ required: true }) hero!: Hero;
  @Input({ required: true }) controller!: HeroesPageComponent;
  @Input() align: 'center' | 'start' = 'center';
}
