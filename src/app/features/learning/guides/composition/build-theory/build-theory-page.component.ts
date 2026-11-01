import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../../../shared/components/eyebrow/eyebrow.component';
import { NoticeComponent } from '../../../../../shared/components/notice/notice.component';
import { HeroImageFallbackDirective } from '../../../../../shared/directives/hero-image-fallback.directive';

interface BuildType {
  name: string;
  summary: string;
  priority: string;
  example: string;
  image: string;
}

interface UtilitySignal {
  label: string;
  copy: string;
}

@Component({
  selector: 'app-build-theory-page',
  imports: [EyebrowComponent, HeroImageFallbackDirective, NoticeComponent, RouterLink],
  templateUrl: './build-theory-page.component.html',
  styleUrl: '../../guide-article/guide-article.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildTheoryPageComponent {
  readonly buildTypes: BuildType[] = [
    {
      name: 'Utility build',
      summary:
        'A fight plan built around the tools that change enemy options: shields, walls, revives, crowd control, damage boosts, scouting, saves, and cooldown denial.',
      priority: 'Hold the tool until it answers the enemy win condition or creates a clean engage.',
      example:
        'Save a defensive cooldown for the dive, wall off the escape route, or scout the flank before your team commits.',
      image: '/images/heroes/invisible-woman.png',
    },
    {
      name: 'Damage build',
      summary:
        'A plan that maximizes pressure, burst windows, target focus, and finishing power.',
      priority: 'Create uptime without overexposing, then convert cooldown advantages into eliminations.',
      example:
        'Take an off-angle, force the support to look away, then burst when your Vanguard starts the fight.',
      image: '/images/heroes/star-lord.png',
    },
    {
      name: 'Sustain build',
      summary:
        'A plan that wins by surviving longer through healing, shields, armor, damage reduction, revives, and defensive resources.',
      priority: 'Absorb or stabilize pressure until the enemy runs out of resources.',
      example:
        'Play slower, rotate through cover, and trade defensive resources for enemy burst cooldowns.',
      image: '/images/heroes/adam-warlock.png',
    },
    {
      name: 'Mobility build',
      summary:
        'A plan centered on movement tools, fast rotations, vertical access, chase routes, escape paths, and target swaps.',
      priority: 'Use movement to choose the fight location, not just to run after damage is taken.',
      example:
        'Stage on high ground, pressure the backline, then exit before the counter-engage arrives.',
      image: '/images/heroes/spider-man.png',
    },
    {
      name: 'Ultimate build',
      summary:
        'A plan that protects, charges, and converts an ultimate into the fight-winning moment.',
      priority: 'Play around the ult condition instead of spending every resource early.',
      example:
        'Force mobility first, hide the ultimate timing, then combo after the enemy save is gone.',
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
}
