import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { buildCommunityMapsPageView } from '../../community/matches-tab/community-maps-view';
import { CommunityMatchesService } from '../../community/matches-tab/community-matches.service';
import { CommunitySummaryComponent } from '../../community/community-summary/community-summary.component';
import { MapRatesTableComponent } from '../../community/map-rates-table/map-rates-table.component';

/**
 * The Maps tab: the maps players win and lose on most, and every map with a win rate, from the same
 * answer the Overview's short list reads. It is thin, with no ad and kept out of search results, until
 * one map has a rate.
 */
@Component({
  selector: 'app-stats-maps',
  imports: [CommunitySummaryComponent, MapRatesTableComponent, RouterLink],
  templateUrl: './stats-maps.component.html',
  styleUrls: ['../../../shared/styles/stat-panels.css', './stats-maps.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsMapsComponent {
  private readonly matches = toSignal(inject(CommunityMatchesService).getMatches(), { initialValue: undefined });

  protected readonly view = computed(() => buildCommunityMapsPageView(this.matches()));
}
