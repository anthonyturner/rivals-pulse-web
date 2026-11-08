import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { previewRoster } from '../../../hub/preview-data';
import { previewHeroStats } from '../current-hero-stats-data';
import { PreviewPortraitComponent } from '../../../hub/preview-portrait/preview-portrait.component';
import { winRatePreview } from '../preview-views';

/** The three best win rates among heroes with enough matches, as bars. Draws nothing until one has. */
@Component({
  selector: 'app-hero-stats-preview',
  imports: [PreviewPortraitComponent],
  templateUrl: './hero-stats-preview.component.html',
  styleUrl: './hero-stats-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroStatsPreviewComponent {
  private readonly stats = previewHeroStats();
  private readonly roster = previewRoster();

  protected readonly rows = computed(() => {
    const stats = this.stats();
    const roster = this.roster();

    return stats && roster ? winRatePreview(stats, roster) : [];
  });
}
