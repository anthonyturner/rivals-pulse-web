import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

/** Overwolf's Marvel Rivals page, which holds the "Game compliance" section the policies are quoted from. */
export const OVERWOLF_GAME_COMPLIANCE_URL =
  'https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/marvel-rivals#game-compliance';

/**
 * What RivalsPulse shows and does not show about other players, in plain words. Every sentence is
 * written from the desktop app's decision records (ADR-0011, 0012, 0017, 0021 and 0023 in
 * `anthonyturner/rivals_pulse`) or from shipped code, so a sentence changes only when its source does.
 * The privacy notes and the FAQ restate parts of it and must agree with it.
 *
 * Two things are deliberately worded as "coming soon" and must stay so until they ship: the opt-out
 * from being viewable by other app users (issue 754), and limiting a player's match history to the lobby
 * or after a match (overlay pull request 1595).
 */
@Component({
  selector: 'app-fair-play-page',
  imports: [PageHeaderComponent, RouterLink],
  templateUrl: './fair-play-page.component.html',
  styleUrl: '../../shared/styles/reading.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FairPlayPageComponent {
  readonly gameComplianceUrl = OVERWOLF_GAME_COMPLIANCE_URL;
}
