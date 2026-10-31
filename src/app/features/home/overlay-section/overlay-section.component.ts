import { ChangeDetectionStrategy, Component } from '@angular/core';

import { JarvisConsoleComponent } from '../jarvis-console/jarvis-console.component';

export interface OverlayFeature {
  title: string;
  /** Two lines at most. */
  description: string;
  /** Path data for a 24x24 stroked icon. */
  iconPath: string;
}

/**
 * Every claim here is one this repository can show: the in-game ranks line is the one the Jarvis
 * console already makes, and the other two follow from the match upload and the Pulse Atlas feed
 * the overlay reads. Hotkeys and screen names stay out until they are checked against the overlay.
 */
export const OVERLAY_FEATURES: readonly OverlayFeature[] = [
  {
    title: 'Ranks in game',
    description: 'See the ranks of the players in your match while you play.',
    iconPath: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  },
  {
    title: 'Your matches, recorded',
    description: 'The overlay records each match and uploads the result, so these numbers come from real games.',
    iconPath: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  },
  {
    title: 'Community tier list',
    description: 'The same tier list and hero stats as this page, built from Rivals Pulse matches.',
    iconPath: 'M4 6h16M4 12h11M4 18h6',
  },
];

/** What the overlay does: the scripted Jarvis demo, then three plain statements of what it offers. */
@Component({
  selector: 'app-overlay-section',
  imports: [JarvisConsoleComponent],
  templateUrl: './overlay-section.component.html',
  styleUrl: './overlay-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlaySectionComponent {
  readonly features = OVERLAY_FEATURES;
}
