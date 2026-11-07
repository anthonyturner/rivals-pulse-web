import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BrandComponent } from '../../../shared/components/brand/brand.component';
import { GetAppButtonComponent } from '../../../shared/components/get-app-button/get-app-button.component';
import { DISCORD_INVITE_URL } from '../../../shared/discord-invite';
import { GoogleConsentService } from '../../consent/google-consent.service';
import { FOOTER_COLUMNS } from './footer-links';

@Component({
  selector: 'app-footer',
  imports: [RouterLink, BrandComponent, GetAppButtonComponent],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Footer {
  protected readonly consent = inject(GoogleConsentService);

  readonly discordUrl = input(DISCORD_INVITE_URL);

  protected readonly columns = FOOTER_COLUMNS;
  protected readonly year = new Date().getFullYear();
}
