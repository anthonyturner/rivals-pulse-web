import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PositioningGuideComponent } from '../positioning-guide/positioning-guide.component';
import type { PositioningGuide } from '../positioning-guide/positioning-guide.types';

@Component({
  selector: 'app-strategic-cover-page',
  imports: [PositioningGuideComponent],
  template: '<app-positioning-guide [guide]="guide" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategicCoverPageComponent {
  readonly guide: PositioningGuide = {
    title: 'Strategic Cover Usage',
    lede:
      'Cover masterclass notes: be hard to hit and make enemies easy to hit.',
    sourceLabel: 'Watch tutorial',
    sourceUrl: 'https://youtu.be/rqxP_tKV2vc?si=9K2auPgj1OXjaD2y',
    diagram: {
      caption: 'Behind cover you show a small hitbox; a wide peek exposes you to the enemy.',
      rows: [
        {
          label: 'You, behind cover: small hitbox',
          nodes: [{ text: 'You', key: true }, { text: 'Cover' }, { text: 'Enemy' }],
        },
        {
          label: 'Wide peek: overexposed',
          nodes: [{ text: 'You' }, { text: 'Enemy' }],
        },
      ],
    },
    checklist: [
      {
        label: 'Hitbox',
        detail: 'How much of my body can they see?',
      },
      {
        label: 'Enemy Cover',
        detail: 'Can I shift my angle so the enemy is more exposed?',
      },
      {
        label: 'Angles',
        detail: 'Am I fighting one angle or several at once?',
      },
      {
        label: 'Scout',
        detail: 'Did I check enemy movement before committing the shot?',
      },
      {
        label: 'Exit',
        detail: 'Can I return to safety immediately after shooting?',
      },
    ],
    sections: [
      {
        title: 'Minimize Your Hitbox',
        summary:
          'Cover is not just something you stand near. You use it to take body away from the enemy.',
        points: [
          'Do not peek far away from cover: the more space between you and the cover edge, the more of your body is exposed.',
          'Back up or shift until the enemy mostly sees your head or a small slice of your model.',
          'Horizontal cover can hide your lower body; vertical cover can let you shoulder-peek and trade small windows.',
        ],
      },
      {
        title: 'Maximize Enemy Hitbox',
        summary:
          'Good cover usage is not only defensive.',
        points: [
          'Shift left or right until you can see more of the enemy behind their corner. Even one extra shot opportunity matters when they are trying to hide.',
          'Keep your own cover and choose the angle that makes their escape path worse while still giving you a quick way out.',
        ],
      },
      {
        title: 'Deal With One Angle at a Time',
        summary:
          'If you are only shooting one target, do not expose yourself to three angles.',
        points: [
          'Use nearby walls, boxes, stairs, or height changes to block the angles you are not currently fighting.',
          'Move around cover based on the target you want to shoot: one position for C, another for D, another for a side angle.',
          'Your goal is not perfect safety: it is the least exposure possible while still creating pressure.',
        ],
      },
      {
        title: 'Scout Before You Shoot',
        summary:
          'Burst heroes and long-range heroes gain the most from scouting first.',
        points: [
          'Scout first, then peek and shoot. Do not stand in the open waiting for a target to appear: if the enemy sees you early, they can move away before your shot matters.',
          'Charging or preparing behind cover makes your peek harder to react to.',
          'Mechanics improve when positioning reduces surprise movement and gives you predictable targets.',
        ],
      },
      {
        title: 'Peek Parallel to Cover',
        summary:
          'Peeking forward into the enemy makes you easy to hit and your movement predictable.',
        points: [
          'Move parallel to the cover edge instead: peek out, shoot, return. Sideways movement is harder to track.',
          'Good corners improve crosshair placement, and knowing your cover route prevents panic movement when pressured.',
        ],
      },
    ],
    notesTitle: 'Common Mistakes',
    notes: [
      {
        label: 'Wide Peeking',
        detail: 'Standing far from the cover edge exposes your full body and gives enemies repeated shots.',
      },
      {
        label: 'Forward Peeking',
        detail: 'Walking toward the enemy while peeking makes your movement predictable.',
      },
      {
        label: 'Multi-angle Exposure',
        detail: 'Trying to shoot one enemy while A, B, C, and D can all pressure you burns resources fast and gives up the position.',
      },
      {
        label: 'Open Scouting',
        detail: 'Searching for targets in the open warns the enemy and makes your mechanics harder.',
      },
    ],
    drills: [
      {
        label: 'Head-Only Peek',
        detail:
          'In practice range or a custom game, adjust your distance from cover until only a small part of your model is visible before each shot.',
      },
      {
        label: 'One-Angle Rule',
        detail:
          'Play one match where every duel starts by asking: which angle am I blocking with cover right now?',
      },
      {
        label: 'Scout, Shoot, Reset',
        detail:
          'Before every burst attempt, briefly scout from cover, peek parallel, fire, then return behind the same corner.',
      },
    ],
    timestamps: [
      { label: '0:00', detail: 'Cover for hitbox and safety.' },
      { label: '1:40', detail: 'Maximizing the enemy hitbox.' },
      { label: '3:38', detail: 'One angle at a time.' },
      { label: '6:31', detail: 'Scouting from cover.' },
      { label: '8:00', detail: 'Peeking parallel, corner mechanics.' },
    ],
  };
}
