import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { ProfileFigure } from '../profile-view';

/** Labelled figures, each with a line of detail under it. A figure that was not counted is drawn quieter, never as 0. */
@Component({
  selector: 'app-profile-figure-list',
  templateUrl: './profile-figure-list.component.html',
  styleUrl: './profile-figure-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileFigureListComponent {
  readonly figures = input.required<readonly ProfileFigure[]>();
}
