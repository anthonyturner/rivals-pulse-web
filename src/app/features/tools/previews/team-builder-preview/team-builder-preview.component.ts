import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { HeroSynergiesService } from '../../../insights/hero-synergies.service';
import { PAIR_ROLES } from '../../../insights/team-comps/team-comps-view';
import { previewData, previewRoster } from '../../../hub/preview-data';
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
  private readonly synergiesService = inject(HeroSynergiesService);
  private readonly synergies = previewData(() => this.synergiesService.getHeroSynergies());
  private readonly roster = previewRoster();

  protected readonly roles = PAIR_ROLES;

  protected readonly slots = computed(() => {
    const synergies = this.synergies();
    const roster = this.roster();

    return synergies && roster ? teamPreview(synergies, roster) : [];
  });
}
