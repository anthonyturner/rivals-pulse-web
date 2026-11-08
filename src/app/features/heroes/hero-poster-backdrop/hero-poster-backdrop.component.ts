import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

import { HeroPosterBackdropPreferenceService } from './hero-poster-backdrop-preference.service';
import { YoutubeEmbedCommands } from './youtube-embed-commands';

/** The art behind the hero poster: the portrait, or the hero's gameplay video when the visitor switches it on. */
@Component({
  selector: 'app-hero-poster-backdrop',
  templateUrl: './hero-poster-backdrop.component.html',
  styleUrl: './hero-poster-backdrop.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroPosterBackdropComponent {
  private readonly preference = inject(HeroPosterBackdropPreferenceService);
  private readonly youtube = inject(YoutubeEmbedCommands);

  readonly heroName = input.required<string>();
  readonly imageUrl = input.required<string>();
  /** A muted, looping background embed; null when the hero has no gameplay video of their own. */
  readonly videoUrl = input<SafeResourceUrl | null>(null);

  protected readonly playing = computed(() => this.videoUrl() !== null && this.preference.backdrop() === 'video');

  private readonly player = viewChild<ElementRef<HTMLIFrameElement>>('player');

  /** Changes each time a video starts: a new hero's video, or the switch turned back on. */
  private readonly startedVideo = computed(() => (this.playing() ? this.videoUrl() : null));

  /** The portrait stays visible until the player has loaded, so switching never flashes an empty frame. */
  protected readonly videoLoaded = linkedSignal({ source: this.startedVideo, computation: () => false });

  /** Every video starts muted, because browsers block autoplay with sound. */
  protected readonly soundOn = linkedSignal({ source: this.startedVideo, computation: () => false });

  protected toggle(): void {
    this.preference.set(this.playing() ? 'portrait' : 'video');
  }

  protected toggleSound(): void {
    const soundOn = !this.soundOn();

    this.youtube.send(this.player()?.nativeElement, soundOn ? 'unMute' : 'mute');
    this.soundOn.set(soundOn);
  }
}
