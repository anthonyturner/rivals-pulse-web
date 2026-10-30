import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface CommunityEmptyStateLink {
  label: string;
  path: string;
}

/**
 * The designed "no data yet" state of a Community tab. A tab shows it until its
 * data clears the tab's minimum sample size, so the panel is never blank, zero or NaN.
 */
@Component({
  selector: 'app-community-empty-state',
  imports: [RouterLink],
  templateUrl: './community-empty-state.component.html',
  styleUrl: './community-empty-state.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityEmptyStateComponent {
  readonly heading = input.required<string>();
  readonly preview = input.required<string>();
  readonly link = input<CommunityEmptyStateLink | null>(null);
}
