import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';

import { YoutubePlayerComponent } from '../../../../shared/components/youtube-player/youtube-player.component';
import type { TileChipKind } from '../../../hub/hub-tile.types';
import { KindChipComponent } from '../../../hub/kind-chip/kind-chip.component';

/** Everything a card shows about one tutorial, ready to draw. */
export interface TutorialCardView {
  id: string;
  title: string;
  description: string;
  category: string;
  kind: TileChipKind;
  /** The category and the tags, as one line. */
  topics: string;
  youtubeId: string;
  sourceUrl: string;
  guideUrl?: string;
}

/**
 * One tutorial as a card: its video, which loads only when played, then the title, description and
 * links. `featured` makes it the dark lead card, with its still loaded at once and its topic chip.
 */
@Component({
  selector: 'app-tutorial-card',
  imports: [KindChipComponent, RouterLink, YoutubePlayerComponent],
  templateUrl: './tutorial-card.component.html',
  styleUrl: './tutorial-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.featured]': 'featured()' },
})
export class TutorialCardComponent {
  readonly tutorial = input.required<TutorialCardView>();
  readonly featured = input(false);
  /** The title's heading level: 2 for the lead card, 3 under a topic heading. */
  readonly headingLevel = input<2 | 3>(3);
  /** Whether the video is playing, bound by the page so a card that is rebuilt keeps it. */
  readonly started = model(false);
}
