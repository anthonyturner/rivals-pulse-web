import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { previewRoster } from '../../../hub/preview-data';
import { previewHeroStats } from '../current-hero-stats-data';
import { PreviewPortraitComponent } from '../../../hub/preview-portrait/preview-portrait.component';
import { tierPreview } from '../preview-views';

/** The top heroes of the S, A and B tiers. Draws nothing until the tier list has placed a hero. */
@Component({
  selector: 'app-tier-list-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './tier-list-preview.component.html',
  styleUrl: './tier-list-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TierListPreviewComponent {
  private readonly stats = previewHeroStats();
  private readonly roster = previewRoster();

  protected readonly rows = computed(() => {
    const stats = this.stats();
    const roster = this.roster();

    return stats && roster ? tierPreview(stats, roster) : [];
  });
}
