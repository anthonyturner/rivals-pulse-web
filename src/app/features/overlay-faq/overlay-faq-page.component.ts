import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { OVERWOLF_APP_URL } from '../../shared/overwolf-app';

/**
 * Answers a cautious player's three questions about the overlay: ban risk, data, and Overwolf.
 * Every claim is written out here from the published sources linked beside it (checked 2026-10-30),
 * so a sentence changes only when its source does. The data answer restates the privacy notes and
 * must stay consistent with them.
 */
@Component({
  selector: 'app-overlay-faq-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './overlay-faq-page.component.html',
  styleUrl: './overlay-faq-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayFaqPageComponent {
  /** Overwolf's app review is only a fact about Rivals Pulse until the listing exists. */
  readonly listed = OVERWOLF_APP_URL.length > 0;
}
