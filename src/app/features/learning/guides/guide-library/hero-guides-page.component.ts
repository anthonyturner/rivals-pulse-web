import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { HERO_GUIDES, HeroGuide } from '../hero-guides/hero-guide-data';

interface FundamentalsGuideGroup {
  title: string;
  kicker: string;
  description: string;
  guides: HeroGuide[];
}

@Component({
  selector: 'app-hero-guides-page',
  imports: [CommonModule, PageHeaderComponent, RouterLink],
  templateUrl: './hero-guides-page.component.html',
  styleUrl: './hero-guides-page.component.css',
})
export class HeroGuidesPageComponent {
  readonly guides = HERO_GUIDES;
  readonly heroGuides = this.guides.filter((guide) => guide.category === 'hero');
  readonly fundamentalsGuides = this.guides.filter((guide) => guide.category === 'fundamentals');
  readonly coachMillsGuide = this.guides.find((guide) => guide.heroId === 'coach-mills-ultimate-beginners-guide');

  readonly fundamentalsGuideGroups: FundamentalsGuideGroup[] = [
    {
      kicker: 'Core Fundamentals',
      title: 'Universal habits for every role',
      description:
        'Survival, engagement timing, presence, and fight discipline that apply no matter who you pick.',
      guides: this.fundamentalsGuides.filter((guide) =>
        [
          'neutral-game-fundamentals',
          'survival-discipline',
          'engagement-discipline',
          'season-8-5-discipline',
          'presence-pressure',
        ].includes(guide.heroId),
      ),
    },
    {
      kicker: 'Vanguard Fundamentals',
      title: 'Turns, space control, and solo tanking',
      description:
        'Tank-specific decision guides for walking forward with purpose, giving space safely, and protecting the team without feeding.',
      guides: this.fundamentalsGuides.filter((guide) =>
        [
          'tank-fundamentals-turns-space',
        ].includes(guide.heroId),
      ),
    },
    {
      kicker: 'Duelist Fundamentals',
      title: 'Pressure, angles, target priority, and resets',
      description:
        'Duelist-specific decision guides for creating threat without turning every flank into a death.',
      guides: this.fundamentalsGuides.filter((guide) =>
        [
          'duelist-pressure-over-damage',
          'duelist-disengage-discipline',
          'duelist-target-priority',
          'duelist-off-angle-short',
          'dps-pressure-short',
          'duelist-disengage-short',
          'target-priority-short',
        ].includes(guide.heroId),
      ),
    },
  ];
}
