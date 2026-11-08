import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { GuideCardComponent } from '../guide-card/guide-card.component';
import { HERO_GUIDES, HeroGuide } from '../hero-guides/hero-guide-data';
import { STRATEGIST_GUIDES } from '../strategist-guides/strategist-guides.data';

interface LibraryCard {
  title: string;
  route: string | string[];
  imageUrl: string;
  caption: string | null;
  blurb: string;
}

interface LibraryGroup {
  title: string;
  cards: LibraryCard[];
}

const guidesById = new Map(HERO_GUIDES.map((guide) => [guide.heroId, guide]));

/** The guides to list, in order, each with the caption it carries. */
function guideCards(entries: ReadonlyArray<readonly [heroId: string, caption: string]>): LibraryCard[] {
  return entries.flatMap(([heroId, caption]) => {
    const guide = guidesById.get(heroId);

    return guide ? [toCard(guide, caption)] : [];
  });
}

function toCard(guide: HeroGuide, caption: string): LibraryCard {
  return {
    title: guide.heroName,
    route: ['/hero-guides', guide.heroId],
    imageUrl: guide.image,
    caption,
    blurb: guide.poolJob,
  };
}

function pageCard(title: string, route: string, hero: string, blurb: string, caption: string | null = null): LibraryCard {
  return { title, route, imageUrl: `/images/heroes/${hero}.png`, caption, blurb };
}

const GROUPS: LibraryGroup[] = [
  {
    title: 'Start here',
    cards: [
      ...guideCards([['coach-mills-ultimate-beginners-guide', 'Coach Mills']]),
      pageCard(
        'How to play: first-time guide',
        '/hero-guides/first-time',
        'captain-america',
        'A complete first-match explanation without the interactive course.',
      ),
      pageCard(
        'How to play: interactive course',
        '/beginner-interactive-guide',
        'captain-america',
        'A complete first-match explanation with the interactive course.',
      ),
    ],
  },
  {
    title: 'Hero guides',
    cards: HERO_GUIDES.filter((guide) => guide.category === 'hero').map((guide) => toCard(guide, guide.role)),
  },
  {
    title: 'Fundamentals',
    cards: guideCards([
      ['neutral-game-fundamentals', 'All roles'],
      ['survival-discipline', 'All roles'],
      ['engagement-discipline', 'All roles'],
      ['tempo-and-ultimate-economy', 'All roles'],
      ['season-8-5-discipline', 'All roles'],
      ['presence-pressure', 'All roles'],
      ['tank-fundamentals-turns-space', 'Vanguard'],
      ['duelist-pressure-over-damage', 'Duelist'],
      ['duelist-disengage-discipline', 'Duelist'],
      ['duelist-target-priority', 'Duelist'],
      ['duelist-off-angle-short', 'Duelist'],
      ['dps-pressure-short', 'Duelist'],
      ['duelist-disengage-short', 'Duelist'],
      ['target-priority-short', 'Duelist'],
    ]),
  },
  {
    title: 'Habits and team play',
    cards: [
      pageCard('Hero stats', '/win-rates', 'peni-parker', 'Compare hero win and pick rates in matches RivalsPulse players recorded.', 'RivalsPulse matches'),
      pageCard('Techniques', '/techniques', 'iron-man', 'Train practical mechanics and fight habits from the workbook.'),
      pageCard('Power positions', '/power-positions', 'hawkeye', 'Recognize the locations that make your next fight easier.'),
      pageCard('Strategic cover', '/strategic-cover', 'magneto', 'Turn terrain into safer, repeatable decisions.'),
      pageCard('Build theory', '/build-theory', 'doctor-strange', 'Understand utility, damage, sustain, mobility, and ultimate plans.'),
      pageCard(
        'How to break triple support',
        '/triple-support-counter',
        'luna-snow',
        'Use synchronized dive, burst, and displacement to stop the sustain loop.',
      ),
    ],
  },
  {
    title: 'Strategist lessons',
    cards: [
      pageCard(
        'Strategist video guides',
        '/strategist-guides',
        'luna-snow',
        'Positioning, healing, ultimates and decision rules, taught in short video lessons.',
        `${STRATEGIST_GUIDES.length} lessons`,
      ),
    ],
  },
];

@Component({
  selector: 'app-hero-guides-page',
  imports: [GuideCardComponent, PageHeaderComponent],
  templateUrl: './hero-guides-page.component.html',
  styleUrl: './hero-guides-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroGuidesPageComponent {
  readonly groups = GROUPS;
}
