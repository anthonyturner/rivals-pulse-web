import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { previewMatchups, previewRoster } from '../../../hub/preview-data';
import { PreviewPortraitComponent } from '../../../hub/preview-portrait/preview-portrait.component';
import { divePreview } from '../preview-views';

/** The planner's opening enemy divers and the heroes that answer them. Draws nothing until the matchups name an answer. */
@Component({
  selector: 'app-dive-planner-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './dive-planner-preview.component.html',
  styleUrl: './dive-planner-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DivePlannerPreviewComponent {
  private readonly matchups = previewMatchups();
  private readonly roster = previewRoster();

  protected readonly view = computed(() => {
    const matchups = this.matchups();
    const roster = this.roster();

    return matchups && roster ? divePreview(matchups, roster) : null;
  });
}
