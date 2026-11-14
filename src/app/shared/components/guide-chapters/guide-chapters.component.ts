import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { GuideChapter } from './guide-chapters.types';

@Component({
  selector: 'app-guide-chapters',
  imports: [RouterLink],
  templateUrl: './guide-chapters.component.html',
  styleUrl: './guide-chapters.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuideChaptersComponent {
  readonly chapters = input.required<readonly GuideChapter[]>();
}
