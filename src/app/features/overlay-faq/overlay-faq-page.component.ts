import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, effect, inject, Injector, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { BAN_ANSWER_SOURCES, buildBanAnswer } from '../../shared/ban-answer';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { OVERWOLF_APP_URL } from '../../shared/overwolf-app';

const QUESTION_IDS = ['ban-risk', 'data', 'overwolf'];

/**
 * Answers a cautious player's three questions about the app: ban risk, data, and Overwolf.
 * Every claim is written out from the published sources linked beside it (checked 2026-10-30), so a
 * sentence changes only when its source does. The ban answer is shared with the home page and lives in
 * `shared/ban-answer.ts`. The data answer restates the privacy notes and
 * must stay consistent with them.
 */
@Component({
  selector: 'app-overlay-faq-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './overlay-faq-page.component.html',
  styleUrls: ['../../shared/styles/reading.css', '../../shared/styles/disclosure-chevron.css', './overlay-faq-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayFaqPageComponent {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);

  /** Overwolf's app review is only a fact about RivalsPulse until the listing exists. */
  readonly listed = OVERWOLF_APP_URL.length > 0;
  readonly banAnswer = buildBanAnswer(this.listed);
  readonly banSources = BAN_ANSWER_SOURCES;

  /** Which questions are open. Any number can be, and the first starts open. */
  protected readonly open = signal<Record<string, boolean>>({ 'ban-risk': true });

  constructor() {
    effect(() => {
      const id = this.fragment();

      if (id && QUESTION_IDS.includes(id)) {
        untracked(() => this.reveal(id));
      }
    });
  }

  protected toggle(id: string): void {
    this.open.update((open) => ({ ...open, [id]: !open[id] }));
  }

  /** Opens the question a link points at and moves focus to its button, which the router's own scroll leaves alone. */
  private reveal(id: string): void {
    this.open.update((open) => ({ ...open, [id]: true }));
    afterNextRender(() => this.document.getElementById(`${id}-button`)?.focus(), { injector: this.injector });
  }
}
