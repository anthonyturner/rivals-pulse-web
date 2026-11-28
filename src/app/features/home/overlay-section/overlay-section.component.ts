import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HomeBandComponent } from '../home-band/home-band.component';

export interface OverlayFeature {
  title: string;
  /** Two lines at most. */
  description: string;
  /** Path data for a 24x24 stroked icon. */
  iconPath: string;
  /** A page on the site that carries the feature on, where there is one. */
  link?: { label: string; path: string };
}

export interface OverlayScreenshot {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

/**
 * What the overlay shows in game, worded from the windows its manifest declares. Hotkeys are left
 * out because players rebind them. Ranks are not shown: the roster HUD shows the players when a match starts.
 */
export const OVERLAY_FEATURES: readonly OverlayFeature[] = [
  {
    title: 'Match preview',
    description: 'A look at the match before round one starts, so you can plan your pick.',
    iconPath: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  },
  {
    title: 'Live team and enemy rosters',
    description: 'Who is on your team and who is on theirs, on screen as soon as the match starts.',
    iconPath: 'M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5M8 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  },
  {
    title: 'Counters and tier list over the game',
    description: 'Open a hero, the tier list or a counter search without leaving the match.',
    iconPath: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5',
  },
  {
    title: 'Session record and stats bar',
    description: 'Your wins and losses this session, and a bar of your own stats while you play.',
    iconPath: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  },
  {
    title: 'Match summary and recap',
    description: 'A summary when the match ends, who left it, and a recap of your last match’s allies and enemies.',
    iconPath: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h8',
  },
  {
    title: 'Your matches on the site',
    description: 'Link the app to your account and the matches it records add up on your own stats page.',
    iconPath: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 8v5l3 2',
    link: { label: 'See your Profile', path: '/profile' },
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

/** What the overlay does in game: a card for each thing it shows, then real captures. */
@Component({
  selector: 'app-overlay-section',
  imports: [HomeBandComponent, RouterLink],
  templateUrl: './overlay-section.component.html',
  styleUrl: './overlay-section.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlaySectionComponent {
  readonly features = OVERLAY_FEATURES;
  readonly screenshots = OVERLAY_SCREENSHOTS;
}
