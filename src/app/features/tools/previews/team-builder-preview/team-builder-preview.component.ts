import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { PAIR_ROLES } from '../../../insights/team-comps/team-comps-view';
import { previewRoster, previewSynergies } from '../../../hub/preview-data';
import { PreviewPortraitComponent } from '../../../hub/preview-portrait/preview-portrait.component';
import { teamPreview } from '../preview-views';

/**
 * Six team slots, two per role, filled with the best duo of each role. A role with no duo leaves its
 * slots as empty plus signs. Draws nothing until at least one role has a duo.
 */
@Component({
  selector: 'app-team-builder-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './team-builder-preview.component.html',
  styleUrl: './team-builder-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamBuilderPreviewComponent {
  private readonly synergies = previewSynergies();
  private readonly roster = previewRoster();

  protected readonly roles = PAIR_ROLES;

  protected readonly slots = computed(() => {
    const synergies = this.synergies();
    const roster = this.roster();

    return synergies && roster ? teamPreview(synergies, roster) : [];
  });
}
