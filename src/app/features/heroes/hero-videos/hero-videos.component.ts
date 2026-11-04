import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  linkedSignal,
} from '@angular/core';

import { HeroVideoSearch } from '../hero.model';

@Component({
  selector: 'app-hero-videos',
  templateUrl: './hero-videos.component.html',
  styleUrl: './hero-videos.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroVideosComponent {
  private readonly injector = inject(Injector);

  readonly heroName = input.required<string>();
  /** Tracked by address in the template: changing a player's address would add a Back step, a new player does not. */
  readonly videos = input.required<HeroVideoSearch[]>();
  readonly youtubeUrl = input.required<string>();

  /** The addresses of the videos whose play button was pressed. A video that leaves the list is dropped, so it asks again if it returns. */
  private readonly started = linkedSignal<HeroVideoSearch[], ReadonlySet<string>>({
    source: this.videos,
    computation: (videos, previous) => {
      const present = new Set(videos.map((video) => video.url));

      return new Set([...(previous?.value ?? [])].filter((url) => present.has(url)));
    },
  });

  protected readonly cards = computed(() =>
    this.videos().map((video) => ({ ...video, started: this.started().has(video.url) })),
  );

  /** Swaps the picture for the player. The button is gone after the press, so focus moves to the player rather than falling to the page. */
  protected play(url: string, event: Event): void {
    const card = (event.currentTarget as HTMLElement).closest('.video-card');

    this.started.update((started) => new Set(started).add(url));
    afterNextRender(() => card?.querySelector('iframe')?.focus(), { injector: this.injector });
  }
}
