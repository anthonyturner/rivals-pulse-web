import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../../../shared/components/eyebrow/eyebrow.component';
import { GuideChaptersComponent } from '../../../../../shared/components/guide-chapters/guide-chapters.component';
import type { GuideChapter } from '../../../../../shared/components/guide-chapters/guide-chapters.types';

interface HeroPick {
  name: string;
  image: string;
  job: string;
}

interface CounterPlan {
  id: string;
  title: string;
  summary: string;
  context: string;
  steps: string[];
  heroes: HeroPick[];
}

@Component({
  selector: 'app-triple-support-guide-page',
  imports: [EyebrowComponent, GuideChaptersComponent, RouterLink],
  templateUrl: './triple-support-guide-page.component.html',
  styleUrls: ['../../../../../shared/styles/field-guide.css', './triple-support-guide-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripleSupportGuidePageComponent {
  readonly source = {
    title: 'How to Counter the Triple Support Meta in Marvel Rivals',
    author: 'Lawrence',
    publisher: 'Dignitas',
    published: 'March 9, 2025',
    url: 'https://dignitas.gg/articles/how-to-counter-the-triple-support-meta-in-marvel-rivals',
  };

  readonly supportCore: HeroPick[] = [
    {
      name: 'Luna Snow',
      image: '/images/heroes/luna-snow.png',
      job: 'On-demand healing and a defensive ultimate that can halt a push.',
    },
    {
      name: 'Cloak & Dagger',
      image: '/images/heroes/cloak-and-dagger.png',
      job: 'Sustain, safety tools, and another fight-extending defensive ultimate.',
    },
    {
      name: 'Invisible Woman',
      image: '/images/heroes/invisible-woman.png',
      job: 'Protection and disruption that make clean eliminations harder to finish.',
    },
    {
      name: 'Loki or Mantis',
      image: '/images/heroes/loki.png',
      job: 'A flexible third slot that can extend ultimate value or amplify damage.',
    },
  ];

  readonly plans: CounterPlan[] = [
    {
      id: 'dive-one-support',
      title: 'Dive one support together',
      summary:
        'Triple support can erase scattered poke, but it struggles when several threats arrive on the same target at the same time.',
      context: 'Staging from more than one direction makes the single Vanguard choose which entrance to cover. The target call only becomes useful when teammates are ready to arrive together. An early fight may catch the composition before several defensive ultimates are available, but a solo dive still gives the healers time to answer it. Treat a pick or a forced ultimate as a reason to reassess and take space, not permission to remain in the backline indefinitely.',
      steps: [
        'Stage from more than one angle so the single Vanguard cannot mark every entry.',
        'Call one Strategist by name and commit together; split damage gives three healers time to recover.',
        'Push the first fight early, before the enemy stores multiple defensive ultimates.',
        'Leave after the elimination or forced ultimate instead of feeding the reset.',
      ],
      heroes: [
        { name: 'Venom', image: '/images/heroes/venom.png', job: 'Starts the backline collapse and absorbs attention.' },
        { name: 'Captain America', image: '/images/heroes/captain-america.png', job: 'Keeps mobile pressure on the called target.' },
        { name: 'Spider-Man', image: '/images/heroes/spider-man.png', job: 'Threatens isolated supports from unexpected angles.' },
        { name: 'Psylocke', image: '/images/heroes/psylocke.png', job: 'Adds fast follow-up damage to secure the pick.' },
        { name: 'Black Panther', image: '/images/heroes/black-panther.png', job: 'Chains mobility through a crowded backline.' },
      ],
    },
    {
      id: 'burst-the-window',
      title: 'Burst through the healing window',
      summary:
        'Healing only matters when a target survives long enough to receive it. Layer control and damage into one short conversion window.',
      context: 'The useful sequence is control followed by damage that arrives before the target can stabilize. Groot can help group the backline or separate a frontline target from healing, but the control needs prompt follow-up. Track defensive ultimates rather than sending every offensive resource into the first answer. A later window, as protection ends, may be worth more than adding another ultimate to an already defended target.',
      steps: [
        'Track defensive support ultimates and avoid spending every offensive ultimate into the first one.',
        'Use Groot control to group the backline or wall the Vanguard away from healing sightlines.',
        'Pair the control window with immediate area or precision burst.',
        'Hold enough damage to punish the moment a defensive ultimate expires.',
      ],
      heroes: [
        { name: 'Groot', image: '/images/heroes/groot.png', job: 'Groups targets and uses walls to interrupt sustain.' },
        { name: 'Moon Knight', image: '/images/heroes/moon-knight.png', job: 'Punishes clustered supports with area damage.' },
        { name: 'Iron Man', image: '/images/heroes/iron-man.png', job: 'Converts grouped targets into a high-damage window.' },
        { name: 'Namor', image: '/images/heroes/namor.png', job: 'Adds reliable pressure while the backline is controlled.' },
      ],
    },
    {
      id: 'break-the-formation',
      title: 'Break the formation',
      summary:
        'The comp depends on overlapping range, protection, and healing. Move one piece out of the formation and the numbers stop working together.',
      context: 'A displaced tank or support may lose the sightlines that make the formation durable. Use corners and walls to create that separation, then help the team use the space it opens. A smaller ultimate can sometimes draw a more valuable defensive response and leave a better re-engage, but the follow-up still needs coordination. Take ground decisively when the composition gives up offensive pressure rather than spending the whole opening on another unfocused damage trade.',
      steps: [
        'Displace the Vanguard away from the supports, or pull a support out of the healing triangle.',
        'Fight around walls and corners that interrupt line of sight between the frontline and backline.',
        'Use a low-cost ultimate to force a premium defensive response, then re-engage.',
        'Capitalize on the comp’s reduced pick pressure by taking space decisively.',
      ],
      heroes: [
        { name: 'Magneto', image: '/images/heroes/magneto.png', job: 'Threatens squishies and punishes post-ultimate timing.' },
        { name: 'Thor', image: '/images/heroes/thor.png', job: 'Bullies the frontline or dives with displacement and burst.' },
        { name: 'Winter Soldier', image: '/images/heroes/winter-soldier.png', job: 'Hooks a target away from support sightlines.' },
        { name: 'Wolverine', image: '/images/heroes/wolverine.png', job: 'Removes the Vanguard from the formation more consistently.' },
      ],
    },
  ];

  readonly fightChecklist = [
    { label: 'Before', detail: 'Identify the most reachable support and count defensive ultimates.' },
    { label: 'Entry', detail: 'Attack from two angles and call the same target.' },
    { label: 'Convert', detail: 'Layer control and burst before healing can stabilize the target.' },
    { label: 'Reset', detail: 'After a pick or forced ultimate, take space without donating stagger deaths.' },
  ];

  readonly traps = [
    'Poking three different targets and charging three support ultimates.',
    'Sending one diver into the backline without synchronized follow-up.',
    'Stacking every offensive ultimate into the first defensive response.',
    'Ignoring the objective and letting the defensive composition win through time.',
    'Treating high healing numbers as proof the composition cannot be broken.',
  ];

  readonly chapters: readonly GuideChapter[] = [
    { id: 'read-the-comp', title: 'Read the formation' },
    ...this.plans.map(({ id, title }) => ({ id, title })),
    { id: 'fight-checks', title: 'Four engagement checks' },
    { id: 'traps', title: 'Avoid the common traps' },
    { id: 'worked-example', title: 'Worked example' },
    { id: 'next-match', title: 'Try this next match' },
    { id: 'sources', title: 'Source and limitations' },
  ];
}
