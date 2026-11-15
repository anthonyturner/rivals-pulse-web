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
      'Use a corner to control what the enemy can see, then choose the smallest useful window to shoot. Good cover protects a decision, not just a place to stand.',
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
        paragraphs: [
          'The useful question is how much of your character the enemy can see. Being near a wall does not help enough if you step far away from its edge to shoot. Adjust your position so the corner hides most of your body and leaves only the part needed for the shot exposed.',
          'Different shapes protect different parts of you. Horizontal cover may hide your lower body; a vertical edge can let you shoulder-peek through a short window. Use the shape in front of you rather than assuming every piece of cover offers the same peek.',
        ],
      },
      {
        title: 'Maximize Enemy Hitbox',
        paragraphs: [
          'Your position also changes how much of the enemy is available to shoot. A small left or right adjustment can reveal more of someone hiding behind a corner and create an opportunity you did not have from the original angle.',
          'Keep the defensive half of that trade. A wider view is useful when your own cover and quick exit remain available; do not turn a small improvement in target exposure into a position you cannot leave.',
        ],
      },
      {
        title: 'Deal With One Angle at a Time',
        paragraphs: [
          'If you are shooting one opponent, avoid giving several others the same chance to shoot you. Walls, boxes, stairs and height changes can remove the sightlines you are not currently fighting. Move around the cover as your chosen target changes instead of expecting one position to answer every angle.',
          'This is a trade between pressure and exposure, not a promise of perfect safety. Choose the least exposure that still lets you make a useful threat, then reassess when another enemy gains a line on you.',
        ],
      },
      {
        title: 'Scout Before You Shoot',
        paragraphs: [
          'Use cover to learn where the shot will be before exposing yourself to take it. Waiting in the open warns enemies early and gives them time to move. This matters especially for burst and long-range heroes whose useful window may be short.',
          'Prepare or charge behind cover when the ability allows it, then peek with a target in mind. That preparation makes the entry less obvious and reduces the surprise movement your aim has to solve. The position helps the mechanics by making the next moment more predictable.',
        ],
      },
      {
        title: 'Peek Parallel to Cover',
        paragraphs: [
          'Moving toward the enemy during the peek gives them a predictable path to track. Move sideways along the cover edge instead: expose the useful window, shoot, and return. The corner supplies a repeatable place for your crosshair and an escape you already understand.',
          'Practise that return as part of the shot. When pressure arrives, a known cover route is more reliable than inventing a movement response in the open.',
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
    workedExample: {
      title: 'Hypothetical: change the angle, keep the exit',
      paragraphs: [
        'An opponent is hiding behind a corner while a second enemy watches the open lane. Shift around your own cover until the first target becomes visible without exposing yourself to both threats. Scout, prepare the shot if needed, peek sideways, and return.',
        'If the adjustment reveals too much of your body or removes the return path, it is not automatically better. The point is to improve the available shot while keeping the cover that makes the exchange manageable.',
      ],
    },
    practiceFocus: 'For one match, identify the angle your cover blocks before taking each duel. Review one death for a wide peek, a forward peek or a missing return route, then practise that same corner in a custom game.',
  };
}
