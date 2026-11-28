import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The small label above a heading. Use it only for a fact the heading does not state, such as a
 * category, role, date or status. It is a paragraph, never a heading, so the heading order does not
 * change. On a dark surface, set `--eyebrow-color` on a parent.
 */
@Component({
  selector: 'app-eyebrow',
  template: '<p class="eyebrow"><ng-content /></p>',
  styleUrl: './eyebrow.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EyebrowComponent {}
