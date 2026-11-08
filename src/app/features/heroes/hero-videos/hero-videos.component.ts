import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { YoutubePlayerComponent } from '../../../shared/components/youtube-player/youtube-player.component';
import { HeroVideoSearch } from '../hero.model';

@Component({
  selector: 'app-hero-videos',
  imports: [YoutubePlayerComponent],
  templateUrl: './hero-videos.component.html',
  styleUrl: './hero-videos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroVideosComponent {
  readonly heroName = input.required<string>();
  /** Tracked by address in the template, so a video given again in a new list keeps its player. */
  readonly videos = input.required<HeroVideoSearch[]>();
  readonly youtubeUrl = input.required<string>();
}
