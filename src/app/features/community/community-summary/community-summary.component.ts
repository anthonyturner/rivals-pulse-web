import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  CommunityEmptyStateComponent,
  type CommunityEmptyStateLink,
} from '../community-empty-state/community-empty-state.component';

/**
 * The frame every summary tab shares. It says the numbers are loading, says they cannot be loaded,
 * shows the designed "not enough data yet" state, or, once the numbers are ready, wraps them with
 * the half-season, the fallback notice and the links to the full pages.
 */
@Component({
  selector: 'app-community-summary',
  imports: [CommunityEmptyStateComponent, RouterLink],
  templateUrl: './community-summary.component.html',
  styleUrl: './community-summary.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunitySummaryComponent {
  readonly kind = input.required<'loading' | 'unavailable' | 'not-enough-data' | 'ready'>();
  readonly heading = input.required<string>();
  /** What the tab shows, as a capitalised noun phrase, for the loading and failure messages. */
  readonly subject = input.required<string>();
  /** The reason there are no numbers yet, when `kind` is `not-enough-data`. */
  readonly summary = input('');
  readonly halfSeasonLabel = input<string | null>(null);
  readonly notice = input<string | null>(null);
  /** The full page this tab summarises. */
  readonly link = input.required<CommunityEmptyStateLink>();
  /** A second page that holds the full numbers, when one page does not. */
  readonly secondLink = input<CommunityEmptyStateLink | null>(null);
}
