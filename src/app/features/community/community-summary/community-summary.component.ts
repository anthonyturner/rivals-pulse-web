import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';

export interface CommunitySummaryLink {
  label: string;
  path: string;
  queryParams?: Record<string, string>;
}

/** Why a total is missing, for the tabs whose figures the database withholds until enough different players contribute. */
export const COMMUNITY_EMPTY_RULE =
  "Totals appear once enough different players have uploaded matches, so no one player's matches are shown as the community's.";

/** The account's own matches and insights, which are not community totals. */
export const MY_STATS_LINK: CommunitySummaryLink = { label: 'See your own matches and insights in My stats', path: '/profile' };

/**
 * The frame every Community tab shares: the tab's heading and season, then either the loading,
 * failure or "not enough data yet" panel, or, once the numbers are ready, the fallback notice, the
 * tab's own content, a footnote and the links to the full pages.
 */
@Component({
  selector: 'app-community-summary',
  imports: [NoticeComponent, RouterLink, StatePanelComponent],
  templateUrl: './community-summary.component.html',
  styleUrl: './community-summary.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunitySummaryComponent {
  readonly kind = input.required<'loading' | 'unavailable' | 'not-enough-data' | 'ready'>();
  readonly heading = input.required<string>();
  /** What the tab shows, as a lower-case noun phrase, for the loading and failure headings. */
  readonly subject = input.required<string>();
  /** The reason there are no numbers yet, when `kind` is `not-enough-data`. */
  readonly summary = input('');
  readonly halfSeasonLabel = input<string | null>(null);
  readonly notice = input<string | null>(null);
  readonly footnote = input<string | null>(null);
  /** A page to go to from this tab: the full page it summarises, or where the visitor's own figures are. Null for none. */
  readonly link = input<CommunitySummaryLink | null>(null);
  /** A second page that holds the full numbers, when one page does not. */
  readonly secondLink = input<CommunitySummaryLink | null>(null);

  protected readonly loadingHeading = computed(() => `Loading ${this.subject()}`);
  protected readonly unavailableHeading = computed(() => {
    const subject = this.subject();

    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} could not be loaded`;
  });
}
