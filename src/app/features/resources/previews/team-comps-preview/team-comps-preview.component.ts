import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { previewRoster, previewSynergies } from '../../../hub/preview-data';
import { PreviewPortraitComponent } from '../../../hub/preview-portrait/preview-portrait.component';
import { pairPreview } from '../../../hub/pair-preview';

/** The best duo of each role. Draws nothing until at least one pair has enough matches. */
@Component({
  selector: 'app-team-comps-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './team-comps-preview.component.html',
  styleUrl: './team-comps-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamCompsPreviewComponent {
  private readonly synergies = previewSynergies();
  private readonly roster = previewRoster();

  protected readonly pairs = computed(() => {
    const synergies = this.synergies();
    const roster = this.roster();

    return synergies && roster ? pairPreview(synergies, roster) : [];
  });
}
