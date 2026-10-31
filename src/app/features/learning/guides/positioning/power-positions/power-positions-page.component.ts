import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

interface GuideSection {
  title: string;
  summary: string;
  points: string[];
}

interface ChecklistItem {
  label: string;
  detail: string;
}

@Component({
  selector: 'app-power-positions-page',
  imports: [CommonModule],
  templateUrl: './power-positions-page.component.html',
  styleUrl: './power-positions-page.component.css',
})
export class PowerPositionsPageComponent {
  readonly sourceVideo = 'https://youtu.be/hnCgeDZCt0I?si=d7wxsqlCxCDMWcwU';

  readonly sections: GuideSection[] = [
    {
      title: 'Definition',
      summary:
        'A power position is a map location that gives your team multiple options: pressure objective, control lanes, scout enemy movement, and leave safely.',
      points: [
        'It is not just any high ground. A good power position creates consistent pressure on the objective or cart.',
        'It gives you several routes or angles instead of forcing you through one choke.',
        'It lets you play aggressively with your position while still using cover, cooldowns, and information patiently.',
      ],
    },
    {
      title: 'Why It Wins Fights',
      summary:
        'Power positions create passive value before anyone commits. The enemy has to look at you, spend cooldowns, back up, or send someone to clear you.',
      points: [
        'Multiple angles make it harder for the enemy to shield, wall, or hold one doorway.',
        'You avoid getting stuck in chokes because you have more than one route into the fight.',
        'You gather information earlier, which helps you decide whether to pressure, rotate, drop, or reset.',
        'You can force enemy actions first, then punish when their cooldowns are already spent.',
      ],
    },
    {
      title: 'How to Find One',
      summary:
        'Look for spots that give you directions, not fixed scripts. The best spot changes based on team tempo, composition, cooldowns, and objective state.',
      points: [
        'Ask whether the spot controls more than one lane: main, side lane, bridge, doorway, stairs, or high ground route.',
        'Check whether you can pressure objective without immediately dropping onto it.',
        'Make sure you can leave: cover, health pack, mobility route, support line of sight, or defensive cooldown.',
        'Adjust to your team. A smart position on the wrong side of the map is worse than a simple plan everyone follows.',
      ],
    },
    {
      title: 'How to Hold It',
      summary:
        'Holding a power position is not standing still. You keep the position valuable by peeking, scouting, trading cooldowns, and rotating from cover to cover.',
      points: [
        'Move corner to corner instead of skipping straight into the enemy face.',
        'Keep support line of sight when possible, but do not give up strong space only because healing might be imperfect.',
        'Use defensive cooldowns as space enablers: shields, mobility, sustain tools, and escape cooldowns buy time to hold pressure.',
        'When the enemy commits resources to clear you, kite, survive, and let your team use the space they gave up.',
      ],
    },
    {
      title: 'When to Leave',
      summary:
        'The goal is not to worship the position. The goal is to use the advantage it gives you, then move when the fight asks for it.',
      points: [
        'Drop only when dropping wins the fight, secures objective, or lets you punish spent cooldowns.',
        'Rotate deeper when your team already won space and the original spot no longer applies pressure.',
        'Give it up if the enemy overcommits and your escape route is the real value.',
        'On control maps, fight for the power spot first, win the fight, then capture the point second.',
      ],
    },
  ];

  readonly checklist: ChecklistItem[] = [
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
      detail: 'Do I have cover, support line of sight, health pack, or cooldowns?',
    },
    {
      label: 'Team Sync',
      detail: 'Does this position support where my team is actually playing?',
    },
  ];

  readonly roleNotes: ChecklistItem[] = [
    {
      label: 'Vanguard',
      detail:
        'Use power positions to decide where the fight happens. Rotate corner to corner, rebuild defensive resources, and force enemies out of strong space.',
    },
    {
      label: 'Duelist',
      detail:
        'Use them to scout, split attention, and open an angle before committing burst. The position should make enemies turn before you spend everything.',
    },
    {
      label: 'Strategist',
      detail:
        'Use them when possible to support lanes proactively. Heroes with mobility can take deeper angles; low-mobility supports may need safer versions with line of sight.',
    },
  ];

  readonly drills: ChecklistItem[] = [
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
  ];

  readonly timestamps: ChecklistItem[] = [
    { label: '1:36', detail: 'Definition of power positions and why they matter.' },
    { label: '3:01', detail: 'Multiple angles of attack and lane control.' },
    { label: '8:22', detail: 'Avoiding chokes and using multiple routes.' },
    { label: '17:33', detail: 'Information, passive value, and forcing enemy cooldowns.' },
    { label: '41:00', detail: 'Support and team questions about taking these spots.' },
    { label: '1:03:30', detail: 'How to find power positions in-game.' },
  ];
}
