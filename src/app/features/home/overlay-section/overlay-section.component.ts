import { ChangeDetectionStrategy, Component } from '@angular/core';

import { HomeBandComponent } from '../home-band/home-band.component';
import { JarvisConsoleComponent } from '../jarvis-console/jarvis-console.component';

export interface OverlayFeature {
  title: string;
  /** Two lines at most. */
  description: string;
  /** The overlay's default hotkeys for it, as the overlay's manifest lists them. */
  keys: readonly string[];
  /** Path data for a 24x24 stroked icon. */
  iconPath: string;
}

export interface OverlayScreenshot {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

/**
 * Each card is a window or widget the overlay's manifest declares with a hotkey, worded from its
 * title there. Ranks are not shown: the roster HUD shows the players when a match starts.
 */
export const OVERLAY_FEATURES: readonly OverlayFeature[] = [
  {
    title: 'Match preview',
    description: 'A look at the match before round one starts.',
    keys: ['Alt+I'],
    iconPath: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  },
  {
    title: 'Team and enemy rosters',
    description: 'See who is on your team and who is on theirs once the match starts.',
    keys: ['Alt+T', 'Alt+E'],
    iconPath: 'M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5M8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  },
  {
    title: 'Last-match recap',
    description: 'Bring back last match’s allies, its enemies and a recap of how it went.',
    keys: ['Alt+P', 'Alt+O', 'Alt+R'],
    iconPath: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v5l3 2',
  },
  {
    title: 'Hero lookup, tier list and counter search',
    description: 'Open a hero, the tier list or a counter search over the game without leaving it.',
    keys: ['Alt+H', 'Alt+M', 'Alt+K'],
    iconPath: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  },
  {
    title: 'Session record and stats bar',
    description: 'Your wins and losses this session, and a bar of your own stats while you play.',
    keys: ['Alt+W', 'Alt+B'],
    iconPath: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  },
  {
    title: 'Match summary and disconnects',
    description: 'A summary of the match when it ends, and a list of the players who left it.',
    keys: ['Alt+U', 'Alt+X'],
    iconPath: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h8',
  },
];

/**
 * Real overlay captures, with the player names pixelated: the names on the victory screen, in the
 * rosters and top bar, and on a nameplate. Keep it that way for any capture added here.
 */
export const OVERLAY_SCREENSHOTS: readonly OverlayScreenshot[] = [
  {
    src: '/images/home/in-game-overlay-victory.jpg',
    width: 1280,
    height: 709,
    alt: 'The RivalsPulse in-game overlay on the Marvel Rivals victory screen: both teams’ rosters across the top, a match bar at the top centre, and the session record, disconnects and a stats bar down the sides.',
    caption: 'On the victory screen',
  },
  {
    src: '/images/home/in-game-overlay-domination.jpg',
    width: 1280,
    height: 709,
    alt: 'The RivalsPulse in-game overlay during a Domination match: both teams’ rosters across the top, a match bar at the top centre, and the session record, disconnects and a stats bar down the sides.',
    caption: 'In a Domination match',
  },
];

/** What the overlay does: real captures, a card for each thing it can show, then the Jarvis demo. */
@Component({
  selector: 'app-overlay-section',
  imports: [HomeBandComponent, JarvisConsoleComponent],
  templateUrl: './overlay-section.component.html',
  styleUrl: './overlay-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlaySectionComponent {
  readonly features = OVERLAY_FEATURES;
  readonly screenshots = OVERLAY_SCREENSHOTS;
}
