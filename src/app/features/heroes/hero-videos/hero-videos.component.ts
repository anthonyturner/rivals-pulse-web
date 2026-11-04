import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HeroVideoSearch } from '../hero.model';

@Component({
  selector: 'app-hero-videos',
  templateUrl: './hero-videos.component.html',
  styleUrl: './hero-videos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroVideosComponent {
  readonly heroName = input.required<string>();
  /** Tracked by address in the template: changing a player's address would add a Back step, a new player does not. */
  readonly videos = input.required<HeroVideoSearch[]>();
  readonly youtubeUrl = input.required<string>();
}
