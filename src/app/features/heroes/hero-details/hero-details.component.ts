import { CommonModule } from '@angular/common';
import { Component, Input, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../shared/components/eyebrow/eyebrow.component';
import { HeroCommunityCountersComponent } from '../hero-community-counters/hero-community-counters.component';
import { HeroCommunityStatsComponent } from '../hero-community-stats/hero-community-stats.component';
import { Hero } from '../hero.model';

@Component({
  selector: 'app-hero-details',
  imports: [CommonModule, EyebrowComponent, HeroCommunityCountersComponent, HeroCommunityStatsComponent, RouterLink],
  templateUrl: './hero-details.component.html',
  styleUrl: './hero-details.component.css',
})
export class HeroDetailsComponent {
  @Input({ required: true }) hero!: Hero;
  @Input({ required: true }) controller!: any;

  /** The page's detail panel: long sections start collapsed, headings and reading lines are smaller. The profile window leaves it off. */
  readonly compact = input(false);
}
