import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { CommunityMatchesService } from './community-matches.service';
import { buildCommunityMatchesView } from './community-matches-view';

const WHAT_THE_TAB_SHOWS = 'Win rate by map, mode mix, average length and matches per day.';

/** The community's match totals: anonymous, counted once per match, never anyone's own matches. */
@Component({
  selector: 'app-community-matches-tab',
  imports: [CommunitySummaryComponent],
  templateUrl: './matches-tab.component.html',
  styleUrl: './matches-tab.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchesTabComponent {
  private readonly matches = toSignal(inject(CommunityMatchesService).getMatches(), {
    initialValue: undefined,
  });

  protected readonly view = computed(() => buildCommunityMatchesView(this.matches()));
  protected readonly emptyPreview = computed(() => {
    const view = this.view();

    return view.kind === 'not-enough-data' ? `${WHAT_THE_TAB_SHOWS} ${view.summary}` : WHAT_THE_TAB_SHOWS;
  });
}
