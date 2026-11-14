import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { GetAppButtonComponent } from '../../../shared/components/get-app-button/get-app-button.component';
import { DISCORD_INVITE_URL } from '../../../shared/discord-invite';
import { HomeBandComponent } from '../home-band/home-band.component';

/**
 * The last band of the home page: the shared get-app button, then a few links. The Discord link is
 * there only once `DISCORD_INVITE_URL` is non-empty. There is deliberately no email field: nothing
 * stores a notify-me address yet.
 */
@Component({
  selector: 'app-closing-cta',
  imports: [GetAppButtonComponent, HomeBandComponent, RouterLink],
  templateUrl: './closing-cta.component.html',
  styleUrl: './closing-cta.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClosingCtaComponent {
  readonly discordUrl = input(DISCORD_INVITE_URL);
}
