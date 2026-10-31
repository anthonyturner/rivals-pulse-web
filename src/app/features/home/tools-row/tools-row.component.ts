import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface HomeTool {
  title: string;
  /** One line on what the tool answers for the visitor. */
  promise: string;
  path: string;
  /** Path data for a 24x24 stroked icon. */
  iconPath: string;
  /** Circles drawn before the path, for icons a single path cannot describe. */
  iconCircles?: readonly { cx: number; cy: number; r: number }[];
}

/**
 * Season-agnostic copy is deliberate: a season name here goes stale the month
 * after it ships, which is how the home page once advertised Season 9 during
 * Season 10.
 */
export const HOME_TOOLS: readonly HomeTool[] = [
  {
    title: 'Tier list',
    promise: 'Every hero ranked from S to D, so you know who to pick.',
    path: '/tier-list',
    iconPath: 'M4 6h16M4 12h11M4 18h6',
  },
  {
    title: 'Team builder',
    promise: 'Build a six-stack and check its role balance and team-ups.',
    path: '/team-builder',
    iconPath: 'M3 20c0-3 2.5-5 5-5s5 2 5 5M11 20c0-3 2.5-5 5-5s5 2 5 5',
    iconCircles: [
      { cx: 8, cy: 8, r: 3 },
      { cx: 16, cy: 8, r: 3 },
    ],
  },
  {
    title: 'Guides',
    promise: 'Learn how to play each hero, from your first match onward.',
    path: '/hero-guides',
    iconPath: 'M4 5a2 2 0 0 1 2-2h13v14H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 0 2 2h13v-4',
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
