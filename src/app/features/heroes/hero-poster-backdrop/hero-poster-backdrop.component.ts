import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

import { AuthService } from '../../../core/auth/auth.service';
import { HeroPosterBackdropPreferenceService } from './hero-poster-backdrop-preference.service';
import { isPlayerReadyMessage, YOUTUBE_EMBED_ORIGIN, YoutubeEmbedCommands } from './youtube-embed-commands';

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
  private readonly auth = inject(AuthService);
  private readonly accountSound = computed(() => this.auth.mediaDefaults()?.sound === true);

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

  /** True once the player has said it takes commands; a command sent before then is lost. */
  private readonly playerReady = linkedSignal({ source: this.startedVideo, computation: () => false });

  constructor() {
    // A signed-in visitor's sound default applies to each video as it starts, when the browser allows sound.
    effect(() => {
      if (this.playerReady() && this.accountSound()) {
        untracked(() => this.applyAccountSound());
      }
    });
  }

  @HostListener('window:message', ['$event'])
  protected onWindowMessage(event: MessageEvent): void {
    const frame = this.player()?.nativeElement;

    if (frame && event.origin === YOUTUBE_EMBED_ORIGIN && event.source === frame.contentWindow && isPlayerReadyMessage(event.data)) {
      this.playerReady.set(true);
    }
  }

  protected onVideoLoaded(): void {
    this.videoLoaded.set(true);
    this.youtube.listen(this.player()?.nativeElement);
  }

  protected toggle(): void {
    this.preference.set(this.playing() ? 'portrait' : 'video');
  }

  protected toggleSound(): void {
    this.setSound(!this.soundOn());
  }

  /** When the browser would block the sound, the video stays muted and the control says so, with no error. */
  private applyAccountSound(): void {
    if (this.youtube.canStartWithSound()) {
      this.setSound(true);
    }
  }

  private setSound(on: boolean): void {
    this.youtube.send(this.player()?.nativeElement, on ? 'unMute' : 'mute');
    this.soundOn.set(on);
  }
}
