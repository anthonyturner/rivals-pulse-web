import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DISCORD_INVITE_URL } from '../../shared/discord-invite';
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
  readonly discordInviteUrl = DISCORD_INVITE_URL;
  readonly todayFields = TODAY_UPLOAD_FIELDS;
  readonly extendedFields = EXTENDED_UPLOAD_FIELDS;
  readonly extendedBeingAdded = EXTENDED_UPLOAD_STATUS === 'being-added';
}
