import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BAN_ANSWER_SOURCES, buildBanAnswer } from '../../shared/ban-answer';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { OVERWOLF_APP_URL } from '../../shared/overwolf-app';

/**
 * Answers a cautious player's three questions about the overlay: ban risk, data, and Overwolf.
 * Every claim is written out from the published sources linked beside it (checked 2026-10-30), so a
 * sentence changes only when its source does. The ban answer is shared with the home page and lives in
 * `shared/ban-answer.ts`. The data answer restates the privacy notes and
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
  readonly banAnswer = buildBanAnswer(this.listed);
  readonly banSources = BAN_ANSWER_SOURCES;
}
