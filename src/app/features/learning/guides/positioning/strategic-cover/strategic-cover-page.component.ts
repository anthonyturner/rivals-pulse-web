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
  selector: 'app-strategic-cover-page',
  imports: [CommonModule],
  templateUrl: './strategic-cover-page.component.html',
  styleUrl: './strategic-cover-page.component.css',
})
export class StrategicCoverPageComponent {
  readonly sourceVideo = 'https://youtu.be/rqxP_tKV2vc?si=9K2auPgj1OXjaD2y';

  readonly sections: GuideSection[] = [
    {
      title: 'Minimize Your Hitbox',
      summary:
        'Cover is not just something you stand near. You use it to remove the amount of body the enemy can see and shoot.',
      points: [
        'Do not peek far away from cover. The more space between you and the cover edge, the more of your body is exposed.',
        'Back up or shift until the enemy mostly sees your head or a small slice of your model.',
        'Horizontal cover can hide your lower body; vertical cover can let you shoulder-peek and trade small windows.',
        'Every extra exposed body part is another chance for the enemy to hit you before you can retreat.',
      ],
    },
    {
      title: 'Maximize Enemy Hitbox',
      summary:
        'Good cover usage is not only defensive. You can position around your cover so the enemy has less cover from your angle.',
      points: [
        'Shift left or right until you can see more of the enemy behind their corner.',
        'Keep your own cover while choosing an angle that makes their escape path worse.',
        'Even one extra shot opportunity matters when the enemy is trying to hide.',
        'The best angle lets you pressure them while still giving yourself a quick way out.',
      ],
    },
    {
      title: 'Deal With One Angle at a Time',
      summary:
        'A common mistake is peeking forward into several threats at once. If you are only shooting one target, do not expose yourself to three angles.',
      points: [
        'Use nearby walls, boxes, stairs, or height changes to block the angles you are not currently fighting.',
        'Move around cover based on the target you want to shoot: one position for C, another for D, another for a side angle.',
        'If too many enemies can see you, you will be forced to spend resources early and give up the position.',
        'Your goal is not perfect safety. Your goal is the least exposure possible while still creating pressure.',
      ],
    },
    {
      title: 'Scout Before You Shoot',
      summary:
        'Cover lets you gather information before committing. This is especially important for burst heroes and long-range heroes.',
      points: [
        'Scout first, then peek and shoot. Do not stand in the open waiting for a target to appear.',
        'Charging or preparing behind cover makes your peek harder to react to.',
        'If the enemy sees you early, they can move away before your shot matters.',
        'Mechanics improve when positioning reduces surprise movement and gives you predictable targets.',
      ],
    },
    {
      title: 'Peek Parallel to Cover',
      summary:
        'Peeking forward into the enemy makes you easy to hit. Peeking sideways along the cover edge keeps movement harder to track.',
      points: [
        'Move parallel to the cover edge: peek out, shoot, return.',
        'Avoid walking directly toward the enemy sightline when you peek.',
        'Good corners improve crosshair placement because you know exactly where your retreat is.',
        'When pressured, already knowing your cover route prevents panic movement.',
      ],
    },
  ];

  readonly checklist: ChecklistItem[] = [
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
  ];

  readonly mistakes: ChecklistItem[] = [
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
      detail: 'Trying to shoot one enemy while A, B, C, and D can all pressure you burns resources fast.',
    },
    {
      label: 'Open Scouting',
      detail: 'Searching for targets in the open warns the enemy and makes your mechanics harder.',
    },
  ];

  readonly drills: ChecklistItem[] = [
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
  ];

  readonly timestamps: ChecklistItem[] = [
    { label: '0:00', detail: 'Cover as hitbox minimization and safety.' },
    { label: '1:40', detail: 'Maximizing enemy hitbox while using your own cover.' },
    { label: '3:38', detail: 'Dealing with one angle at a time.' },
    { label: '6:31', detail: 'Scouting from cover before shooting.' },
    { label: '8:00', detail: 'Peeking parallel to cover and corner mechanics.' },
  ];
}
