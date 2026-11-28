import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { GetAppButtonComponent } from '../../get-app-button/get-app-button.component';
import type { AdSlotId, AdSlotSize } from '../ad-slot.types';

/** The default ad: RivalsPulse's own app. The get-app button inside it shows only once the app has a store listing. */
@Component({
  selector: 'app-house-ad',
  imports: [GetAppButtonComponent],
  templateUrl: './house-ad.component.html',
  styleUrl: './house-ad.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HouseAdComponent {
  readonly slotId = input.required<AdSlotId>();
  readonly size = input.required<AdSlotSize>();
}
