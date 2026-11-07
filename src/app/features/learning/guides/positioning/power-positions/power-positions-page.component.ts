import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PositioningGuideComponent } from '../positioning-guide/positioning-guide.component';
import type { PositioningGuide } from '../positioning-guide/positioning-guide.types';

@Component({
  selector: 'app-power-positions-page',
  imports: [PositioningGuideComponent],
  template: '<app-positioning-guide [guide]="guide" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerPositionsPageComponent {
  readonly guide: PositioningGuide = {
    title: 'Power Positions',
    lede:
      'Notes from the masterclass: how to find, hold, and leave power positions.',
    sourceLabel: 'Watch masterclass',
    sourceUrl: 'https://youtu.be/hnCgeDZCt0I?si=d7wxsqlCxCDMWcwU',
    diagram: {
      caption:
        'Your team holds a power position off the main lane, with sight of the objective and the enemy approach.',
      rows: [
        {
          nodes: [
            { text: 'Team' },
            { text: 'Main' },
            { text: 'Power Position', key: true },
            { text: 'Objective' },
            { text: 'Enemy' },
          ],
        },
      ],
    },
    checklist: [
      {
        label: 'Options',
        detail: 'Can I attack, rotate, drop, or reset from here?',
      },
      {
        label: 'Pressure',
        detail: 'Does this spot threaten objective, cart, or an important lane?',
      },
      {
        label: 'Information',
        detail: 'Can I see where the enemy is setting up before I commit?',
      },
      {
        label: 'Safety',
        detail: 'Do I have cover, a mobility route, support line of sight, health pack, or cooldowns?',
      },
      {
        label: 'Team Sync',
        detail: 'Does this position support where my team is actually playing?',
      },
    ],
    sections: [
      {
        title: 'Definition',
        summary:
          'A power position is a map location that gives your team multiple options: control lanes, scout enemy movement, and leave safely.',
        points: [
          'It is not just any high ground. A good power position creates consistent pressure on the objective or cart.',
          'It lets you play aggressively with your position while still using cover, cooldowns, and information patiently.',
        ],
      },
      {
        title: 'Why It Wins Fights',
        summary:
          'Power positions create passive value before anyone commits: the enemy has to react to you.',
        points: [
          'Multiple angles make it harder for the enemy to shield, wall, or hold one doorway, and a second route keeps you from getting stuck in a choke.',
          'You gather information earlier, so you can decide to pressure, rotate, drop, or reset.',
          'You can force enemy actions first, then punish when their cooldowns are already spent.',
        ],
      },
      {
        title: 'How to Find One',
        summary:
          'Look for directions, not fixed scripts: the best spot changes with team tempo, composition, cooldowns, and objective state.',
        points: [
          'Ask whether the spot controls more than one lane (main, side lane, bridge, doorway, stairs, high ground route) and pressures the objective without dropping onto it.',
          'Adjust to your team: a smart position on the wrong side of the map is worse than a simple plan everyone follows.',
        ],
      },
      {
        title: 'How to Hold It',
        summary:
          'Holding a power position is not standing still.',
        points: [
          'Peek and scout corner to corner instead of skipping straight into the enemy face.',
          'Keep support line of sight when possible, but do not give up strong space over imperfect healing.',
          'Use shields, mobility, sustain tools, and escape cooldowns as space enablers: they buy time to hold pressure.',
          'When the enemy commits resources to clear you, kite, survive, and let your team use the space they gave up.',
        ],
      },
      {
        title: 'When to Leave',
        summary:
          'Use the advantage the position gives you, then move when the fight asks for it.',
        points: [
          'Drop only when dropping wins the fight, secures objective, or lets you punish spent cooldowns.',
          'Rotate deeper when your team already won space and the original spot no longer applies pressure.',
          'Give it up if the enemy overcommits and your escape route is the real value.',
          'On control maps, fight for the power spot first, win the fight, then capture the point second.',
        ],
      },
    ],
    notesTitle: 'Role Notes',
    notes: [
      {
        label: 'Vanguard',
        detail:
          'Use power positions to decide where the fight happens. Rebuild defensive resources and force enemies out of strong space.',
      },
      {
        label: 'Duelist',
        detail:
          'Use them to scout, split attention, open an angle, and make enemies turn before you commit your burst.',
      },
      {
        label: 'Strategist',
        detail:
          'Use them to support lanes proactively. Mobile heroes can take deeper angles; low-mobility supports may need safer versions with line of sight.',
      },
    ],
    drills: [
      {
        label: 'Three-Lane Scan',
        detail:
          'Before the first fight, name main lane, one side lane, and the power position that connects or pressures them.',
      },
      {
        label: 'Do Not Drop Early',
        detail:
          'Hold the spot until the enemy spends cooldowns, your team commits, or dropping clearly wins the fight.',
      },
      {
        label: 'Cooldown Trade Review',
        detail:
          'After one replay, mark every time your position forced enemy movement, panic cooldowns, or attention.',
      },
    ],
    timestamps: [
      { label: '1:36', detail: 'Definition and why power positions matter.' },
      { label: '3:01', detail: 'Multiple angles and lane control.' },
      { label: '8:22', detail: 'Avoiding chokes, using more routes.' },
      { label: '17:33', detail: 'Information, passive value, cooldowns.' },
      { label: '41:00', detail: 'Support and team questions.' },
      { label: '1:03:30', detail: 'Finding power positions in-game.' },
    ],
  };
}
