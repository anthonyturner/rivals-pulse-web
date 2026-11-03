import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EyebrowComponent } from '../../../../../shared/components/eyebrow/eyebrow.component';
import { videoUrlAt } from '../../youtube-timestamp';
import type { PositioningGuide } from './positioning-guide.types';

/** The article the positioning guides share: a diagram, a checklist, key ideas, notes and drills. */
@Component({
  selector: 'app-positioning-guide',
  imports: [EyebrowComponent],
  templateUrl: './positioning-guide.component.html',
  styleUrls: ['../../../../../shared/styles/guide-article.css', './positioning-guide.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PositioningGuideComponent {
  readonly guide = input.required<PositioningGuide>();

  readonly timestamps = computed(() => {
    const { sourceUrl, timestamps } = this.guide();

    return timestamps.map((timestamp) => ({ ...timestamp, url: videoUrlAt(sourceUrl, timestamp.label) }));
  });
}
