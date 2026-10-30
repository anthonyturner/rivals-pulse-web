import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface HomeTool {
  title: string;
  /** One line on what the tool answers, not what it is. */
  promise: string;
  action: string;
  path: string;
  /** Path data for a 24x24 stroked icon. */
  iconPath: string;
  /** Extra circles the icon needs, drawn before the path. */
  iconCircles?: readonly { cx: number; cy: number; r: number }[];
}

/**
 * Routes that already exist but were only reachable from the Tools menu.
 *
 * The copy stays season-agnostic on purpose: naming the live season here would
 * go stale the month after it ships, which is how the home page ended up
 * advertising Season 9 during Season 10.
 */
export const HOME_TOOLS: readonly HomeTool[] = [
  {
    title: 'Counters',
    promise: 'Pick an enemy hero and see who beats them, by rank.',
    action: 'Find a counter',
    path: '/counters',
    iconPath: 'M4 20 20 4M4 4l6 6M14 14l6 6',
  },
  {
    title: 'Team builder',
    promise: 'Build a six-stack and check its role balance and team-ups.',
    action: 'Build a team',
    path: '/team-builder',
    iconPath: 'M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5',
    iconCircles: [
      { cx: 8, cy: 8, r: 3 },
      { cx: 16, cy: 8, r: 3 },
    ],
  },
  {
    title: 'Tier list',
    promise: 'Every hero from S to D, refreshed every six hours.',
    action: 'See the tiers',
    path: '/tier-list',
    iconPath: 'M4 6h16M4 12h11M4 18h6',
  },
  {
    title: 'Win rates',
    promise: 'Win and pick rate for every hero, Bronze through One Above All.',
    action: 'Compare heroes',
    path: '/win-rates',
    iconPath: 'M3 17l5-6 4 3 6-8 3 3',
  },
];

@Component({
  selector: 'app-tools-row',
  imports: [RouterLink],
  templateUrl: './tools-row.component.html',
  styleUrl: './tools-row.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolsRowComponent {
  readonly tools = HOME_TOOLS;
}
