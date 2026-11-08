import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { previewRoster } from '../../../hub/preview-data';
import { previewMatchups } from '../current-hero-matchups-data';
import { PreviewPortraitComponent } from '../../../hub/preview-portrait/preview-portrait.component';
import { counterPreview } from '../preview-views';

/** One enemy hero and the heroes with a winning record against it. Draws nothing until the matchups name one. */
@Component({
  selector: 'app-counters-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './counters-preview.component.html',
  styleUrl: './counters-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CountersPreviewComponent {
  private readonly matchups = previewMatchups();
  private readonly roster = previewRoster();

  protected readonly view = computed(() => {
    const matchups = this.matchups();
    const roster = this.roster();

    return matchups && roster ? counterPreview(matchups, roster) : null;
  });
}
