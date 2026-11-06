import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../shared/components/eyebrow/eyebrow.component';
import { HeroBuildSignalsComponent } from '../hero-build-signals/hero-build-signals.component';
import { HeroCommunityCountersComponent } from '../hero-community-counters/hero-community-counters.component';
import { HeroCommunityStatsComponent } from '../hero-community-stats/hero-community-stats.component';
import { HeroKillFeedComponent } from '../hero-kill-feed/hero-kill-feed.component';
import { HeroVideosComponent } from '../hero-videos/hero-videos.component';
import { Hero } from '../hero.model';

const HERO_DETAIL_SECTIONS = [
  'overview',
  'abilities',
  'build-signals',
  'matchups',
  'stats',
  'strategy',
  'team-ups',
  'videos',
] as const;

type HeroDetailSection = (typeof HERO_DETAIL_SECTIONS)[number];

@Component({
  selector: 'app-hero-details',
  imports: [
    EyebrowComponent,
    HeroBuildSignalsComponent,
    HeroCommunityCountersComponent,
    HeroCommunityStatsComponent,
    HeroKillFeedComponent,
    HeroVideosComponent,
    RouterLink,
  ],
  templateUrl: './hero-details.component.html',
  styleUrl: './hero-details.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroDetailsComponent implements OnChanges {
  @Input({ required: true }) hero!: Hero;
  @Input({ required: true }) controller!: any;

  readonly selectedSection = signal<HeroDetailSection>('overview');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hero'] && !changes['hero'].firstChange) {
      this.selectedSection.set('overview');
    }
  }

  selectSection(section: HeroDetailSection): void {
    this.selectedSection.set(section);
  }

  handleSectionTabKeydown(event: KeyboardEvent): void {
    if (!(event.currentTarget instanceof HTMLElement)) {
      return;
    }

    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    const currentIndex = tabs.findIndex((tab) => tab === event.target);

    if (currentIndex < 0 || tabs.length === 0) {
      return;
    }

    let nextIndex: number;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();

    const nextTab = tabs[nextIndex];
    const nextSection = HERO_DETAIL_SECTIONS.find(
      (section) => section === nextTab.dataset['section'],
    );

    if (nextSection) {
      this.selectSection(nextSection);
      nextTab.focus();
    }
  }
}
