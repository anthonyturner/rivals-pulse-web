import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ADSENSE_CONFIG, hasAdSenseSlot } from '../../shared/components/ad-slot/adsense/adsense.config';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import {
  EXTENDED_UPLOAD_FIELDS,
  EXTENDED_UPLOAD_STATUS,
  PLANNED_UPLOAD_FIELDS,
  PULSE_RECORDS_STATUS,
  TODAY_UPLOAD_FIELDS,
} from './privacy-notes.data';

@Component({
  selector: 'app-privacy-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './privacy-page.component.html',
  styleUrls: ['../../shared/styles/reading.css', './privacy-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyPageComponent {
  readonly todayFields = TODAY_UPLOAD_FIELDS;
  readonly extendedFields = EXTENDED_UPLOAD_FIELDS;
  readonly plannedFields = PLANNED_UPLOAD_FIELDS;
  /** Whether Google ads can appear yet, which is when an ad unit id is set. The page words the ads paragraph to match. */
  readonly adsLive = hasAdSenseSlot(inject(ADSENSE_CONFIG));
  readonly recordsBeingAdded = PULSE_RECORDS_STATUS === 'being-added';
  readonly extendedBeingAdded = EXTENDED_UPLOAD_STATUS === 'being-added';
  /** The heading of the section the app's extra fields are in, and its entry in the contents list. */
  readonly extendedHeading = this.extendedBeingAdded ? 'What the app is adding (being added)' : 'What the app also uploads';
  /** One entry for each section, in page order. A spec checks the labels against the page's headings. */
  readonly contents = [
    { id: 'summary', label: 'The short version' },
    { id: 'uploaded-today', label: 'What the app uploads at launch' },
    { id: 'extended-fields', label: this.extendedHeading },
    { id: 'public-numbers', label: 'What this website publishes' },
    { id: 'pulse-records', label: 'Pulse Records' },
    { id: 'retention', label: 'How long it is kept' },
    { id: 'accounts', label: 'Accounts and signing in' },
    { id: 'advertising', label: 'Advertising' },
    { id: 'videos', label: 'YouTube videos' },
    { id: 'more', label: 'More' },
  ];
}
