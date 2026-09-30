import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { Hero } from '../hero.model';

@Component({
  selector: 'app-hero-role-switcher',
  imports: [CommonModule],
  templateUrl: './hero-role-switcher.component.html',
  styleUrl: './hero-role-switcher.component.css',
})
export class HeroRoleSwitcherComponent {
  @Input({ required: true }) hero!: Hero;
  @Input({ required: true }) controller!: any;
  @Input() align: 'center' | 'start' = 'center';
}
