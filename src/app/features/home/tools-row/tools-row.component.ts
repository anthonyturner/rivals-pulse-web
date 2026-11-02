import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HomeBandComponent } from '../home-band/home-band.component';

export interface HomeTool {
  title: string;
  /** One line on what the tool answers for the visitor. */
  promise: string;
  path: string;
  /** The link's words, naming where it goes. */
  action: string;
  /** What the app does with the same answer in game; left out where there is no honest counterpart. */
  inOverlay?: string;
  /** Path data for a 24x24 stroked icon. */
  iconPath: string;
  /** Circles drawn before the path, for icons a single path cannot describe. */
  iconCircles?: readonly { cx: number; cy: number; r: number }[];
}

/**
 * Season-agnostic copy is deliberate: a season name here goes stale the month
 * after it ships, which is how the home page once advertised Season 9 during
 * Season 10. Hotkeys are left out because players rebind them.
 */
export const HOME_TOOLS: readonly HomeTool[] = [
  {
    title: 'Hero stats',
    promise: 'Win rate, pick rate and tier for every hero, counted from matches RivalsPulse players record.',
    path: '/community',
    action: 'See hero stats',
    inOverlay: 'The matches the app records are what these numbers count.',
    iconPath: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  },
  {
    title: 'Tier list',
    promise: 'Every hero ranked from S to D, so you know who is strong right now.',
    path: '/tier-list',
    action: 'See the tier list',
    inOverlay: 'Open the tier list over the game.',
    iconPath: 'M4 6h16M4 12h11M4 18h6',
  },
  {
    title: 'Counters',
    promise: 'Look up who counters a hero, and who that hero counters.',
    path: '/counters',
    action: 'Find a counter',
    inOverlay: 'Search counters without leaving the match.',
    iconPath: 'M12 2v4M12 18v4M2 12h4M18 12h4',
    iconCircles: [{ cx: 12, cy: 12, r: 5 }],
  },
  {
    title: 'Team builder',
    promise: 'Build a six-stack and check its role balance and team-ups.',
    path: '/team-builder',
    action: 'Build a team',
    iconPath: 'M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5',
    iconCircles: [
      { cx: 8, cy: 8, r: 3 },
      { cx: 16, cy: 8, r: 3 },
    ],
  },
  {
    title: 'Heroes',
    promise: 'Every hero in the game, with their role and abilities.',
    path: '/heroes',
    action: 'Browse heroes',
    inOverlay: 'Look up any hero mid-match.',
    iconPath: 'M4 21c0-4 3.5-6 8-6s8 2 8 6',
    iconCircles: [{ cx: 12, cy: 8, r: 4 }],
  },
  {
    title: 'Guides',
    promise: 'Learn how to play each hero, from your first match onward.',
    path: '/hero-guides',
    action: 'Read the guides',
    iconPath: 'M4 5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 0 2 2h13v-4',
  },
];

@Component({
  selector: 'app-tools-row',
  imports: [HomeBandComponent, RouterLink],
  templateUrl: './tools-row.component.html',
  styleUrl: './tools-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolsRowComponent {
  readonly tools = HOME_TOOLS;
}
