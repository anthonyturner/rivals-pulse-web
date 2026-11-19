import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { OVERWOLF_APP_URL } from '../../../shared/overwolf-app';
import { HomeBandComponent } from '../home-band/home-band.component';
import { TrustBlockComponent } from '../trust-block/trust-block.component';

export interface HowItWorksStep {
  title: string;
  text: string;
}

/**
 * Three things the app is known to do, and nothing more: it is installed from Overwolf, it runs
 * beside the game, and it records each match for this site's numbers. Whether the install step says
 * "coming soon" follows the Overwolf listing. Autostart, hotkeys and Pulsa stay out of the steps
 * because they are not what makes the numbers on this site.
 */
export function buildHowItWorksSteps(listed: boolean): readonly HowItWorksStep[] {
  return [
    {
      title: 'Install RivalsPulse from Overwolf',
      text: listed
        ? 'RivalsPulse is an Overwolf app. Get it from the Overwolf store.'
        : 'RivalsPulse is an Overwolf app. It is coming soon to the Overwolf store.',
    },
    {
      title: 'Play Marvel Rivals with RivalsPulse running',
      text: 'RivalsPulse runs beside the game through Overwolf while you play.',
    },
    {
      title: 'Your matches are recorded and counted',
      text: "Each match is recorded and counted into this site's stats, and added to your own match history.",
    },
  ];
}

/** How the app turns your matches into the numbers on this site, then the ban question answered. */
@Component({
  selector: 'app-how-it-works',
  imports: [HomeBandComponent, TrustBlockComponent],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HowItWorksComponent {
  readonly listed = input(OVERWOLF_APP_URL.length > 0);

  readonly steps = computed(() => buildHowItWorksSteps(this.listed()));
}
