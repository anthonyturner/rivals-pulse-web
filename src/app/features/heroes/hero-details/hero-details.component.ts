import {
  ChangeDetectionStrategy,
  Component,
  computed,
  Input,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroBuildSignalsComponent } from '../hero-build-signals/hero-build-signals.component';
import { HeroCommunityCountersComponent } from '../hero-community-counters/hero-community-counters.component';
import { HeroCommunityStatsComponent } from '../hero-community-stats/hero-community-stats.component';
import { HeroKillFeedComponent } from '../hero-kill-feed/hero-kill-feed.component';
import { HeroVideosComponent } from '../hero-videos/hero-videos.component';
import { Hero, HeroAbilityTechnicalDetail, HeroRole } from '../hero.model';

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

const DIFFICULTY_PIPS = [1, 2, 3, 4, 5] as const;

/** The two controller reads that depend on the selected role, which is why the banner is a `computed()`. */
interface HeroBannerSource {
  heroRoleLabel(hero: Hero): HeroRole;
  officialBaseStats(hero: Hero): HeroAbilityTechnicalDetail[];
}

interface HeroBanner {
  /** The hero's last name word in capitals, drawn behind the header as decoration. */
  watermark: string;
  /** Sets the banner's role colour; see `.hero-poster.role-*` in the stylesheet. */
  roleClass: string;
  kicker: string;
  stats: HeroAbilityTechnicalDetail[];
  difficulty: number;
  difficultyLabel: string;
  pips: readonly number[];
}

@Component({
  selector: 'app-hero-details',
  imports: [
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

  private readonly bannerSource = signal<{ hero: Hero; controller: HeroBannerSource } | null>(null);

  /** Read through a computed so the banner follows the controller's selected role as well as the inputs. */
  readonly banner = computed<HeroBanner | null>(() => {
    const source = this.bannerSource();

    if (!source) {
      return null;
    }

    const { hero, controller } = source;
    const role = controller.heroRoleLabel(hero);
    const archetype = hero.gameplayArchetypes?.find((candidate) => candidate.role === role);

    return {
      watermark: hero.name.trim().split(/\s+/).at(-1)?.toUpperCase() ?? '',
      roleClass: `role-${role.toLowerCase()}`,
      kicker: archetype ? `${role} · ${archetype.label}` : role,
      stats: controller.officialBaseStats(hero),
      difficulty: hero.difficulty,
      difficultyLabel: `Difficulty ${hero.difficulty} out of 5`,
      pips: DIFFICULTY_PIPS,
    };
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['hero'] || changes['controller']) {
      this.bannerSource.set({ hero: this.hero, controller: this.controller });
    }

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
