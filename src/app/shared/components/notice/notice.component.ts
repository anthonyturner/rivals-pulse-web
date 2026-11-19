import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A short amber note above a page's numbers, such as the previous half-season standing in for the current one. */
@Component({
  selector: 'app-notice',
  template: '<p class="notice" role="note"><ng-content /></p>',
  styleUrl: './notice.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NoticeComponent {}
