import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { OVERWOLF_APP_URL } from '../../overwolf-app';

/**
 * The one "Get RivalsPulse on Overwolf" button. Until `OVERWOLF_APP_URL` is set it renders nothing,
 * rather than a link to a listing that does not exist or a "Coming soon" button; once it is set,
 * the link appears in the same place.
 */
@Component({
  selector: 'app-get-app-button',
  templateUrl: './get-app-button.component.html',
  styleUrl: './get-app-button.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GetAppButtonComponent {
  readonly appUrl = input(OVERWOLF_APP_URL);

  readonly hasAppUrl = computed(() => this.appUrl().length > 0);
}
