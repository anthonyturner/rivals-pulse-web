import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Hero } from '../hero.model';

@Component({
  selector: 'app-hero-details',
  imports: [CommonModule, RouterLink],
  templateUrl: './hero-details.component.html',
  styleUrl: './hero-details.component.css',
})
export class HeroDetailsComponent {
  @Input({ required: true }) hero!: Hero;
  @Input({ required: true }) controller!: any;
}
