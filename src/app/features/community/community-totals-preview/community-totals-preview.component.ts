import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { previewData } from '../../hub/preview-data';
import { CommunityMatchesService } from '../matches-tab/community-matches.service';
import { communityTotalsPreview } from './community-totals-preview-view';

/**
 * The community's real totals for the half-season shown: how many matches are counted, their
 * average length and the season. A figure the answer does not carry is left out, and the whole
 * preview draws nothing while there is none, on the server and if the request fails.
 */
@Component({
  selector: 'app-community-totals-preview',
  templateUrl: './community-totals-preview.component.html',
  styleUrl: './community-totals-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityTotalsPreviewComponent {
  private readonly matches = previewData(() => inject(CommunityMatchesService).getMatches());

  protected readonly figures = computed(() => communityTotalsPreview(this.matches()));
}
