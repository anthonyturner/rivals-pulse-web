import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroCommunityCountersComponent } from '../hero-community-counters/hero-community-counters.component';
import { HeroCommunityStatsComponent } from '../hero-community-stats/hero-community-stats.component';
import { Hero } from '../hero.model';

@Component({
  selector: 'app-hero-details',
  imports: [CommonModule, HeroCommunityCountersComponent, HeroCommunityStatsComponent, RouterLink],
  templateUrl: './hero-details.component.html',
  styleUrl: './hero-details.component.css',
})
export class HeroDetailsComponent {
  @Input({ required: true }) hero!: Hero;
  @Input({ required: true }) controller!: any;
}
