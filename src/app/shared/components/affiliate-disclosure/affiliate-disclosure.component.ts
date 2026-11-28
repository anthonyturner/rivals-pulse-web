import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The line that says a page's links earn RivalsPulse a commission. Put it next to affiliate links,
 * wherever they appear, so the disclosure is never separated from the link it is about.
 */
@Component({
  selector: 'app-affiliate-disclosure',
  template: `<p class="affiliate-disclosure">
    Some links on this page are affiliate links. If you buy through one, RivalsPulse may earn a
    commission at no extra cost to you.
  </p>`,
  styleUrl: './affiliate-disclosure.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffiliateDisclosureComponent {}
