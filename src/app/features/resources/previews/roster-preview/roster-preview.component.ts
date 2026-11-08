import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { previewRoster } from '../../../hub/preview-data';

/** How many heroes are on the roster. Draws nothing until the roster has loaded. */
@Component({
  selector: 'app-roster-preview',
  templateUrl: './roster-preview.component.html',
  styleUrl: './roster-preview.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RosterPreviewComponent {
  private readonly roster = previewRoster();

  protected readonly count = computed(() => this.roster()?.length ?? 0);
}
