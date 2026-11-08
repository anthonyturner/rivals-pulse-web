import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { HeroSynergiesService } from '../../../insights/hero-synergies.service';
import { previewData, previewRoster } from '../preview-data';
import { PreviewPortraitComponent } from '../preview-portrait/preview-portrait.component';
import { pairPreview } from '../preview-views';

/** The best duo of each role. Draws nothing until at least one pair has enough matches. */
@Component({
  selector: 'app-team-comps-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './team-comps-preview.component.html',
  styleUrl: './team-comps-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamCompsPreviewComponent {
  private readonly synergiesService = inject(HeroSynergiesService);
  private readonly synergies = previewData(() => this.synergiesService.getHeroSynergies());
  private readonly roster = previewRoster();

  protected readonly pairs = computed(() => {
    const synergies = this.synergies();
    const roster = this.roster();

    return synergies && roster ? pairPreview(synergies, roster) : [];
  });
}
