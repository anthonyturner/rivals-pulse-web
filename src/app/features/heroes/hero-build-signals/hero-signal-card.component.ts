import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HeroSignalCard } from './hero-build-signals';

/** One team member's build signals: five small scores, or how far along the hero is. */
@Component({
  selector: 'app-hero-signal-card',
  templateUrl: './hero-signal-card.component.html',
  styleUrl: './hero-signal-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSignalCardComponent {
  readonly card = input.required<HeroSignalCard>();
}
