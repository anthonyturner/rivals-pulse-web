import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../../../shared/components/eyebrow/eyebrow.component';
import { GuideChaptersComponent } from '../../../../../shared/components/guide-chapters/guide-chapters.component';
import type { GuideChapter } from '../../../../../shared/components/guide-chapters/guide-chapters.types';
import { videoUrlAt } from '../../youtube-timestamp';
import type { PositioningGuide } from './positioning-guide.types';

@Component({
  selector: 'app-positioning-guide',
  imports: [EyebrowComponent, GuideChaptersComponent, RouterLink],
  templateUrl: './positioning-guide.component.html',
  styleUrls: ['../../../../../shared/styles/field-guide.css', './positioning-guide.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PositioningGuideComponent {
  readonly guide = input.required<PositioningGuide>();

  readonly sections = computed(() => this.guide().sections.map((section, index) => ({
    ...section,
    id: `chapter-${index + 1}`,
    number: String(index + 1).padStart(2, '0'),
  })));

  readonly chapters = computed<readonly GuideChapter[]>(() => [
    ...this.sections().map(({ id, title }) => ({ id, title })),
    { id: 'position-test', title: 'Five-question test' },
    { id: 'role-notes', title: this.guide().notesTitle },
    { id: 'practice-drills', title: 'Practice drills' },
    { id: 'worked-example', title: 'Worked example' },
    { id: 'next-match', title: 'Try this next match' },
    { id: 'sources', title: 'Source moments' },
  ]);

  readonly timestamps = computed(() => {
    const { sourceUrl, timestamps } = this.guide();

    return timestamps.map((timestamp) => ({ ...timestamp, url: videoUrlAt(sourceUrl, timestamp.label) }));
  });
}
