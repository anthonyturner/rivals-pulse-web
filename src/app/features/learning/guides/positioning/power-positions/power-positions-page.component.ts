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
      'A strong position gives you useful pressure and more than one next move. Learn how to find it, hold it with your team, and leave before the advantage disappears.',
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
        paragraphs: [
          'A power position is useful because of the choices it gives your team. From the same area, you can threaten a lane, learn where enemies are moving, and still have a way to rotate or retreat. Height alone does not provide that value; the position needs to influence the objective or payload.',
          'You can be aggressive about the ground you hold while remaining patient with your resources. Cover, cooldowns and information let you keep the threat available without committing your life to every opening.',
        ],
      },
      {
        title: 'Why It Wins Fights',
        paragraphs: [
          'A position can work before anyone makes a full commitment. An enemy who must respect more than one angle cannot solve every threat by shielding one lane or walling one doorway. Your second route also keeps the team from depending on a single choke.',
          'Earlier information gives you time to choose between pressure, rotation, dropping and resetting. Let the enemy show how they intend to clear you. If they spend cooldowns first, that response may create the opening you were waiting for.',
        ],
      },
      {
        title: 'How to Find One',
        paragraphs: [
          'Look for relationships between lanes rather than memorizing one spot as the answer to every fight. Main, a side route, a bridge, stairs or a doorway may connect in a way that lets you pressure the objective without dropping onto it. The right choice changes with team tempo, composition, cooldowns and objective state.',
          'Check that your teammates can use the position too. A clever location on the wrong side of the map can achieve less than a simple route everyone understands. The five-question test below turns that team and map check into a repeatable decision.',
        ],
      },
      {
        title: 'How to Hold It',
        paragraphs: [
          'Holding the area still involves movement. Scout and peek from corner to corner instead of jumping straight into the enemy. Keep friendly healing sightlines when possible, while judging whether imperfect healing really requires surrendering otherwise strong space.',
          'Shields, movement, sustain and an escape cooldown can buy time for the position to keep working. When enemies commit resources to remove you, retreat through the space you prepared and survive. Their attempt to clear you may have left room for your teammates elsewhere; standing still until you die wastes that trade.',
        ],
      },
      {
        title: 'When to Leave',
        paragraphs: [
          'Do not drop simply because an enemy is below you. Give up the height when it helps win the fight, secures the objective, or punishes resources the enemy has spent. Once your team has taken enough ground that the original position no longer threatens anything, move forward with that advantage.',
          'Sometimes leaving is the value: an enemy overcommit is a reason to use the exit, not to defend the spot at any cost. On control maps, the lesson is to win useful space and the fight before turning that advantage into a capture, rather than walking onto the point without a playable position.',
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
    workedExample: {
      title: 'Hypothetical: hold the angle until the fight changes',
      paragraphs: [
        'Your team holds an area beside the main route with a view of the objective and another way out. An enemy spends cooldowns to force you away. Instead of immediately dropping into the contest, retreat through cover and let your teammates use the attention you drew.',
        'If the response gives your team a clear opportunity to finish the fight, commit with them. If your original angle no longer reaches the fight, rotate. The example depends on the routes and support sightlines actually available; the diagram is a relationship sketch, not a map-specific route.',
      ],
    },
    practiceFocus: 'Before the first fight, name a lane you can pressure and an exit you can use. In replay, check whether you stayed after the position stopped helping, or dropped before the enemy gave you a reason.',
  };
}
