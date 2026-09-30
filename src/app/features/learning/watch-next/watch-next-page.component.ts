import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

type RoleAnswer = 'Vanguard' | 'Duelist' | 'Strategist' | 'Flexible';
type ProblemAnswer = 'Positioning' | 'Timing' | 'Role impact' | 'Mindset' | 'Review';
type FormatAnswer = 'Short lessons' | 'Masterclasses' | 'Hero examples' | 'VOD reviews';

interface TutorialRecommendation {
  title: string;
  reason: string;
  url: string;
  image: string;
  tags: string[];
  roles: RoleAnswer[];
  problems: ProblemAnswer[];
  formats: FormatAnswer[];
}

interface PracticeRecommendation {
  title: string;
  cue: string;
  drill: string;
  review: string;
  problems: ProblemAnswer[];
  roles: RoleAnswer[];
}

@Component({
  selector: 'app-watch-next-page',
  imports: [CommonModule],
  templateUrl: './watch-next-page.component.html',
  styleUrl: './watch-next-page.component.css',
})
export class WatchNextPageComponent {
  readonly roles: RoleAnswer[] = ['Flexible', 'Vanguard', 'Duelist', 'Strategist'];
  readonly problems: ProblemAnswer[] = ['Positioning', 'Timing', 'Role impact', 'Mindset', 'Review'];
  readonly formats: FormatAnswer[] = ['Short lessons', 'Masterclasses', 'Hero examples', 'VOD reviews'];

  readonly selectedRole = signal<RoleAnswer>('Flexible');
  readonly selectedProblem = signal<ProblemAnswer>('Positioning');
  readonly selectedFormat = signal<FormatAnswer>('Short lessons');

  readonly recommendations: TutorialRecommendation[] = [
    {
      title: 'Strategic Cover Usage',
      reason: 'Start here if fights feel random or you take too much damage before your team can trade.',
      url: 'https://youtu.be/rqxP_tKV2vc?si=9K2auPgj1OXjaD2y',
      image: '/images/heroes/doctor-strange.png',
      tags: ['Cover', 'Survivability', 'Sightlines'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
      problems: ['Positioning'],
      formats: ['Short lessons', 'Masterclasses'],
    },
    {
      title: 'You Are Using High Ground Wrong',
      reason: 'Best next watch when you reach good positions but give them up before they create value.',
      url: 'https://youtu.be/_PdmvN0s0ew?si=E8lcu1rTkWXSU3mi',
      image: '/images/heroes/iron-man.png',
      tags: ['High Ground', 'Angles', 'Map Control'],
      roles: ['Flexible', 'Duelist', 'Strategist'],
      problems: ['Positioning'],
      formats: ['Short lessons'],
    },
    {
      title: 'Non-linear Rotations',
      reason: 'Use this when your route into fights is predictable or you keep walking through the enemy main lane.',
      url: 'https://youtu.be/oAdjNFeiOrQ?si=ZQxCLxHa_fukSotJ',
      image: '/images/heroes/spider-man.png',
      tags: ['Rotations', 'Pathing', 'Tempo'],
      roles: ['Flexible', 'Duelist', 'Strategist'],
      problems: ['Positioning', 'Timing'],
      formats: ['Short lessons'],
    },
    {
      title: 'Timing in Marvel Rivals',
      reason: 'The strongest pick when you often engage too early, too late, or without overlapping pressure.',
      url: 'https://youtu.be/yftUQIsApMI?si=BkzIi2ynIWqEiaOD',
      image: '/images/heroes/psylocke.png',
      tags: ['Timing', 'Engage', 'Fight Planning'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
      problems: ['Timing'],
      formats: ['Masterclasses', 'Short lessons'],
    },
    {
      title: 'Target Priority in Marvel Rivals',
      reason: 'Watch this when you do damage but struggle to convert pressure into fight wins.',
      url: 'https://youtu.be/HoiwKJLR_tA?si=_oS8swCV9MkR7aOt',
      image: '/images/heroes/hela.png',
      tags: ['Target Priority', 'Decision Making', 'Pressure'],
      roles: ['Flexible', 'Duelist', 'Vanguard'],
      problems: ['Timing', 'Role impact'],
      formats: ['Masterclasses'],
    },
    {
      title: 'How to Carry on Vanguard',
      reason: 'Use this path when you need to create space instead of only surviving on point.',
      url: 'https://youtu.be/TOZZRM5JnSM?si=ODAVv83RtZxvguXr',
      image: '/images/heroes/the-thing.png',
      tags: ['Vanguard', 'Space', 'Cooldowns'],
      roles: ['Vanguard', 'Flexible'],
      problems: ['Role impact', 'Positioning'],
      formats: ['Masterclasses'],
    },
    {
      title: 'How to Carry on Duelist',
      reason: 'Pick this if you want a clearer setup process before committing for kills.',
      url: 'https://youtu.be/6FGNkCvqhgA?si=FSi0vTdUwu3O86xG',
      image: '/images/heroes/star-lord.png',
      tags: ['Duelist', 'Setup', 'Threat'],
      roles: ['Duelist', 'Flexible'],
      problems: ['Role impact', 'Timing'],
      formats: ['Masterclasses', 'Hero examples'],
    },
    {
      title: 'How to Carry on Strategist',
      reason: 'Watch this when you want to carry through utility, resources, and proactive lane pressure.',
      url: 'https://youtu.be/K9Ce8VTHxuc?si=0HDhL7-D9wkvjCsJ',
      image: '/images/heroes/mantis.png',
      tags: ['Strategist', 'Utility', 'Resources'],
      roles: ['Strategist', 'Flexible'],
      problems: ['Role impact', 'Positioning'],
      formats: ['Masterclasses'],
    },
    {
      title: 'How Number One Jeff Controls Space',
      reason: 'A strong hero example for Strategist players learning how support positioning changes fights.',
      url: 'https://youtu.be/veOh-WKr4Xw?si=_s1DeN9iMPJtgUh7',
      image: '/images/heroes/jeff-the-land-shark.png',
      tags: ['Jeff', 'Strategist', 'Space'],
      roles: ['Strategist', 'Flexible'],
      problems: ['Positioning', 'Role impact'],
      formats: ['Hero examples', 'VOD reviews'],
    },
    {
      title: "Sinatra's Star-Lord Breakdown",
      reason: 'Use this when you want a concrete Duelist example for scouting, setup, and pressure timing.',
      url: 'https://youtu.be/YX2xq2RXV7o?si=1SxRqhS7w1LB4B6E',
      image: '/images/heroes/star-lord.png',
      tags: ['Star-Lord', 'Duelist', 'Setup'],
      roles: ['Duelist', 'Flexible'],
      problems: ['Timing', 'Role impact'],
      formats: ['Hero examples', 'VOD reviews'],
    },
    {
      title: 'How to Self-review',
      reason: 'Best next step when you are not sure what problem is repeating across your matches.',
      url: 'https://youtu.be/qbjD4v91UOk',
      image: '/images/heroes/rocket-raccoon.png',
      tags: ['VOD Review', 'Practice', 'Improvement'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
      problems: ['Review'],
      formats: ['VOD reviews', 'Short lessons'],
    },
    {
      title: 'How to Deal with Tilt',
      reason: 'Start here when your decisions get worse after one bad fight or one bad teammate interaction.',
      url: 'https://youtu.be/3leIrDmkHbs?si=oiLno2-O5oqqg9tT',
      image: '/images/heroes/scarlet-witch.png',
      tags: ['Tilt', 'Mental', 'Reset'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
      problems: ['Mindset'],
      formats: ['Short lessons', 'Masterclasses'],
    },
    {
      title: 'Master Consistency in Marvel Rivals',
      reason: 'A good follow-up when you want a repeatable practice structure instead of one-off improvement spikes.',
      url: 'https://youtu.be/r-MDhF7li2s?si=R3DnPYsAr2gsA0iH',
      image: '/images/heroes/luna-snow.png',
      tags: ['Consistency', 'Mindset', 'Practice'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
      problems: ['Mindset', 'Review'],
      formats: ['Masterclasses'],
    },
  ];

  readonly practices: PracticeRecommendation[] = [
    {
      title: 'Cover Before Damage',
      cue: 'Cover first, damage second.',
      drill: 'Play three fights where every first peek starts within one second of cover.',
      review: 'Count deaths where cover was unavailable when the enemy answered.',
      problems: ['Positioning'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
    },
    {
      title: 'Target, Trigger, Exit',
      cue: 'Name the target, trigger, and exit before committing.',
      drill: 'For one match, only hard engage after you can name all three parts.',
      review: 'Clip one early engage and one well-timed engage.',
      problems: ['Timing'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
    },
    {
      title: 'Role Value Check',
      cue: 'What did my cooldown gain?',
      drill: 'After each major cooldown, label it as space, pressure, save, reset, or wasted.',
      review: 'Find the most common wasted cooldown and decide the earlier setup fix.',
      problems: ['Role impact'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
    },
    {
      title: 'One-Cue Reset',
      cue: 'Say the cue before leaving spawn.',
      drill: 'Choose one cue for the whole session: cover first, wait for engage, or save escape.',
      review: 'After the block, rate whether the cue changed your next-fight decision.',
      problems: ['Mindset'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
    },
    {
      title: 'Three-Death Review',
      cue: 'Find the first decision that made each death likely.',
      drill: 'Review only the first three deaths of one replay.',
      review: 'Sort each death into route, cooldown, target, timing, or position.',
      problems: ['Review'],
      roles: ['Flexible', 'Vanguard', 'Duelist', 'Strategist'],
    },
  ];

  readonly rankedRecommendations = computed(() => {
    const role = this.selectedRole();
    const problem = this.selectedProblem();
    const format = this.selectedFormat();

    return this.recommendations
      .map((recommendation) => ({
        recommendation,
        score:
          (recommendation.roles.includes(role) ? 3 : 0) +
          (recommendation.problems.includes(problem) ? 4 : 0) +
          (recommendation.formats.includes(format) ? 2 : 0) +
          (recommendation.roles.includes('Flexible') ? 1 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.recommendation);
  });

  readonly practiceRecommendation = computed(() => {
    const role = this.selectedRole();
    const problem = this.selectedProblem();

    return (
      this.practices.find((practice) => practice.problems.includes(problem) && practice.roles.includes(role)) ??
      this.practices[0]
    );
  });

  selectRole(role: RoleAnswer): void {
    this.selectedRole.set(role);
  }

  selectProblem(problem: ProblemAnswer): void {
    this.selectedProblem.set(problem);
  }

  selectFormat(format: FormatAnswer): void {
    this.selectedFormat.set(format);
  }
}
