import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { GuideChaptersComponent } from '../../../../shared/components/guide-chapters/guide-chapters.component';
import type { GuideChapter } from '../../../../shared/components/guide-chapters/guide-chapters.types';
import { HeroImageFallbackDirective } from '../../../../shared/directives/hero-image-fallback.directive';

interface FirstTimeGuideSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly steps?: readonly string[];
}

@Component({
  selector: 'app-first-time-guide-page',
  imports: [GuideChaptersComponent, HeroImageFallbackDirective, RouterLink],
  templateUrl: './first-time-guide-page.component.html',
  styleUrls: ['../../../../shared/styles/field-guide.css', './first-time-guide-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstTimeGuidePageComponent {
  readonly sections: readonly FirstTimeGuideSection[] = [
    {
      id: 'understand-the-game',
      title: 'What kind of game is this?',
      paragraphs: [
        'Marvel Rivals is a team hero shooter. Hero abilities, positioning and timing help your team win a fight; controlling the objective turns that advantage into round progress. You are helping teammates take a better fight, rather than trying to win six unrelated duels.',
        'Start with a manageable job: stay alive, use cover and fight where teammates can help. As you learn your hero, connect their abilities to that team effort. Some heroes create room to move, some supply damage pressure, and others keep the fight stable through healing and utility.',
      ],
    },
    {
      id: 'choose-a-role',
      title: 'Pick a role before you worry about a main',
      paragraphs: [
        'A role gives your decisions a theme while the roster is unfamiliar. Vanguards help the team cross dangerous ground and hold important areas, absorbing or blocking pressure at useful moments. Duelists create threat from lanes, side angles or high ground and finish enemies who are distracted or vulnerable.',
        'Strategists heal, protect and stabilize teammates while using utility and safe damage to contribute. Try several heroes across the roles, then spend a session learning one job. You do not need to choose a permanent main before you understand what you enjoy making easier for the team.',
      ],
    },
    {
      id: 'first-match-plan',
      title: 'Your first match plan',
      paragraphs: [
        'Give your first match a small, repeatable loop instead of trying to master every system. Preparing a position, joining the team entry and regrouping after a loss are useful on any map or role. Use the following sequence to decide what to do next.',
      ],
      steps: [
        'Before the fight starts, find your team and identify the path most players are taking.',
        'Choose cover before you shoot. If the enemy looks at you, you should already know where you will hide.',
        'Enter fights when your team can also fight. Going in alone is the fastest way to feel like the game is unfair.',
        'After a death, regroup. Running back into the enemy one by one gives them free progress and delays your next real team fight.',
      ],
    },
    {
      id: 'read-team-fights',
      title: 'How team fights work',
      paragraphs: [
        'Before a committed fight, teams poke, rotate and search for better angles. The real clash develops when someone spends cooldowns, claims ground, dives a target or contests the objective. Pressure becomes easier to convert when teammates threaten the enemy at the same time.',
        'Read the change in player numbers as the fight develops. After your team secures the first elimination, advance carefully with teammates and help finish without chasing too far. After losing two or more players early, retreat unless the round is about to end. Arriving one by one or dying late makes the next full fight harder to organize.',
      ],
    },
    {
      id: 'positioning',
      title: 'Positioning basics',
      paragraphs: [
        'Cover gives you a way to stop incoming damage without requiring a cooldown or a teammate to rescue you. Begin close enough to use it when the enemy turns. Standing in an open lane where several enemies can see you makes each decision more urgent and harder to read.',
        'High ground can offer useful sightlines, exits and control over when to drop into the fight. Use it when it improves those choices, then decide your escape before committing. Even a poor engage is easier to learn from when you can recover; one with no exit is more likely to end at the respawn screen.',
      ],
    },
    {
      id: 'target-priority',
      title: 'Target priority for beginners',
      paragraphs: [
        'You do not need a complete matchup chart to choose a useful target. Start with enemies who are low, isolated, exposed or missing movement and defensive abilities. If a tank is receiving uninterrupted healing and your team is making no progress, continuing to shoot them may leave the actual problem untouched.',
        'The target can change when your own backline is attacked. Helping a Strategist survive may contribute more than pursuing someone far away. When no priority is clear, add pressure to a teammate\'s reachable target; focused damage is generally easier to turn into an opening than damage spread across the whole enemy team.',
      ],
    },
    {
      id: 'spend-resources',
      title: 'Ultimates and cooldowns',
      paragraphs: [
        'Give an ability a purpose before pressing it: gaining space, surviving pressure, saving an ally, securing a target or escaping. If every tool is spent during preparation, you have fewer answers when the enemy finally commits. Being ready to cast is only the start of the decision.',
        'Ultimates also need a useful moment. Look for teammate follow-up or a cast that stops the enemy\'s way of winning the fight. Early mistakes are part of learning; afterwards, ask whether the team was ready and whether the enemy still had an easy response. That explains more than judging the animation or damage alone.',
      ],
    },
    {
      id: 'review-one-habit',
      title: 'What to focus on after the match',
      paragraphs: [
        'Review one death from the decision before it. An exposed route, missing cover, early engage, unavailable cooldown or absent teammate can explain the loss before the final shot. Choose one cue for the next match: cover first, wait for the team, save the escape or pressure with a teammate.',
        'A better decision is progress even in a lost match, so do not measure learning only by wins. When these basics begin to feel familiar, use the hero guides for more specific lessons or revisit the interactive beginner course to practise recognizing the right moment.',
      ],
    },
  ];

  readonly quickRules: readonly string[] = [
    'Fight with teammates.',
    'Use cover before damage.',
    'Reset after lost fights.',
    'Spend cooldowns with a purpose.',
    'Shoot targets your team can punish.',
  ];

  readonly chapters: readonly GuideChapter[] = [
    { id: 'five-rules', title: 'Five rules to start with' },
    ...this.sections.map(({ id, title }) => ({ id, title })),
    { id: 'worked-example', title: 'A first-match decision' },
    { id: 'next-match', title: 'Try this next match' },
  ];
}
