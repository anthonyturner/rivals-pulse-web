import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ADSENSE_CONFIG, hasAdSenseSlot } from '../../shared/components/ad-slot/adsense/adsense.config';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  EXTENDED_UPLOAD_FIELDS,
  EXTENDED_UPLOAD_STATUS,
  TODAY_UPLOAD_FIELDS,
} from './privacy-notes.data';

@Component({
  selector: 'app-privacy-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './privacy-page.component.html',
  styleUrl: './privacy-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {
  readonly todayFields = TODAY_UPLOAD_FIELDS;
  readonly extendedFields = EXTENDED_UPLOAD_FIELDS;
  /** Whether Google ads can appear yet, which is when an ad unit id is set. The page words the ads paragraph to match. */
  readonly adsLive = hasAdSenseSlot(inject(ADSENSE_CONFIG));
  readonly extendedBeingAdded = EXTENDED_UPLOAD_STATUS === 'being-added';
}
