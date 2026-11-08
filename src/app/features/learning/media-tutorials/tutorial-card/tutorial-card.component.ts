import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
} from '@angular/core';
import type { SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import type { TileChipKind } from '../../../hub/hub-tile.types';

/** Everything a card shows about one tutorial, ready to draw. */
export interface TutorialCardView {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: TileChipKind;
  tags: string;
  thumbnailUrl: string;
  embedUrl: SafeResourceUrl;
  sourceUrl: string;
  guideUrl?: string;
}

/**
 * One tutorial as a card: its still with a play button, then the topic, title, description and
 * links. No YouTube page loads until the play button is pressed; the still swaps for the player
 * then, and the button is gone, so focus moves to the player. `featured` makes it the dark lead
 * card, with the still loaded at once; any other card loads its still lazily.
 */
@Component({
  selector: 'app-tutorial-card',
  imports: [RouterLink],
  templateUrl: './tutorial-card.component.html',
  styleUrl: './tutorial-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.featured]': 'featured()' },
})
export class TutorialCardComponent {
  private readonly injector = inject(Injector);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tutorial = input.required<TutorialCardView>();
  readonly featured = input(false);
  /** The title's heading level: 2 for the lead card, 3 under a topic heading. */
  readonly headingLevel = input<2 | 3>(3);

  /** Whether the play button was pressed. A card shown for a different tutorial asks again. */
  protected readonly started = linkedSignal<TutorialCardView, boolean>({ source: this.tutorial, computation: () => false });

  protected play(): void {
    this.started.set(true);
    afterNextRender(() => this.element.nativeElement.querySelector('iframe')?.focus(), { injector: this.injector });
  }
}
