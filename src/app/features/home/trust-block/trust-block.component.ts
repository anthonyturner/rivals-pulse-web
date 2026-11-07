import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BAN_ANSWER_SOURCES, buildBanAnswer } from '../../../shared/ban-answer';
import { OVERWOLF_APP_URL } from '../../../shared/overwolf-app';

/**
 * The ban question answered on the home page, with the same words and sources as /faq, which
 * is linked for the rest. The heading asks the question rather than calling the app safe, as that
 * page never does.
 */
@Component({
  selector: 'app-trust-block',
  imports: [RouterLink],
  templateUrl: './trust-block.component.html',
  styleUrl: './trust-block.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrustBlockComponent {
  readonly listed = input(OVERWOLF_APP_URL.length > 0);

  readonly answer = computed(() => buildBanAnswer(this.listed()));
  readonly sources = BAN_ANSWER_SOURCES;
}
