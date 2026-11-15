import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../../../shared/components/eyebrow/eyebrow.component';
import { GuideChaptersComponent } from '../../../../../shared/components/guide-chapters/guide-chapters.component';
import type { GuideChapter } from '../../../../../shared/components/guide-chapters/guide-chapters.types';
import { HeroImageFallbackDirective } from '../../../../../shared/directives/hero-image-fallback.directive';

interface BuildType {
  name: string;
  paragraphs: string[];
  image: string;
}

interface UtilitySignal {
  label: string;
  copy: string;
}

@Component({
  selector: 'app-build-theory-page',
  imports: [EyebrowComponent, GuideChaptersComponent, HeroImageFallbackDirective, RouterLink],
  templateUrl: './build-theory-page.component.html',
  styleUrls: ['../../../../../shared/styles/field-guide.css', './build-theory-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildTheoryPageComponent {
  readonly buildTypes: BuildType[] = [
    {
      name: 'Utility build',
      paragraphs: [
        'A utility plan centers on a tool that changes the enemy\'s available choices: a shield, wall, revive, control effect, damage boost, scout, save or cooldown denial. Its priority is to keep that answer available until the relevant threat appears or the team can use it to enter cleanly.',
        'For example, reserve protection for a dive, close an escape route with a wall, or scout a flank before teammates commit. The ability earns its value through the choice it changes; spending it simply because it is ready may leave the important moment unanswered.',
      ],
      image: '/images/heroes/invisible-woman.png',
    },
    {
      name: 'Damage build',
      paragraphs: [
        'A damage plan aims to turn pressure and focused burst into an elimination. First create time to attack without overexposing yourself, then use a target\'s missing defensive resources as the opportunity to finish.',
        'An off-angle can make a support turn away while your Vanguard starts the fight. That sequence gives your burst a reason and a timing window. Chasing damage without the position or opening does not serve the same plan.',
      ],
      image: '/images/heroes/star-lord.png',
    },
    {
      name: 'Sustain build',
      paragraphs: [
        'A sustain plan tries to outlast enemy pressure through healing, shields, armor, damage reduction, revives and other defenses. The aim is to stabilize the team until the opponent has spent the resources that made their attack dangerous.',
        'A slower rotation through cover can trade a defensive tool for an enemy burst cooldown without surrendering the whole fight. Survival needs that resource exchange behind it; it is not merely a reason to remain in place taking damage.',
      ],
      image: '/images/heroes/adam-warlock.png',
    },
    {
      name: 'Mobility build',
      paragraphs: [
        'A mobility plan uses movement to choose where the next exchange happens. Fast rotations, vertical access, chase routes, escapes and target changes all matter, but movement is more useful when it sets up the fight than when it only repairs damage already taken.',
        'Staging on high ground before threatening the backline can give you an entry and an exit in the same plan. Leave before the counter-engage removes that exit rather than treating mobility as a promise that every chase will be safe.',
      ],
      image: '/images/heroes/spider-man.png',
    },
    {
      name: 'Ultimate build',
      paragraphs: [
        'An ultimate plan protects the conditions for a decisive cast while building toward it. That may require saving other resources instead of spending them early in a trade that does not help the ultimate connect.',
        'You might force enemy movement first, avoid revealing the timing and combine abilities after the opposing save has been used. The plan is the preparation and conversion together, not the ultimate button on its own.',
      ],
      image: '/images/heroes/magneto.png',
    },
  ];

  readonly utilitySignals: UtilitySignal[] = [
    {
      label: 'Enemy win condition',
      copy: 'What ability, ultimate, or angle is the enemy trying to win with?',
    },
    {
      label: 'Reserved answer',
      copy: 'Which cooldown must stay available until that threat appears?',
    },
    {
      label: 'Timing trigger',
      copy: 'What event tells you to spend the utility: dive starts, wall breaks, support is pressured, or ultimate is cast?',
    },
    {
      label: 'Exit plan',
      copy: 'Where do you go after the utility is spent so the trade stays favorable?',
    },
  ];

  readonly decisionQuestions = [
    'What wins this fight if I use it at the right second?',
    'What happens if I spend this cooldown early?',
    'Can my team follow up when this utility lands?',
    'Does this build solve our actual problem or just pad stats?',
  ];

  readonly chapters: readonly GuideChapter[] = [
    { id: 'choose-the-plan', title: 'Choose a fight plan' },
    { id: 'compare-the-plans', title: 'Compare five approaches' },
    { id: 'utility-sequence', title: 'Recognize a utility plan' },
    { id: 'decision-check', title: 'Four decision questions' },
    { id: 'worked-example', title: 'Worked example' },
    { id: 'next-match', title: 'Try this next match' },
  ];
}
