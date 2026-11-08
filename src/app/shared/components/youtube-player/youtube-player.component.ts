import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/**
 * One YouTube video that loads only when played: its still with a play button, which swaps for the
 * player when pressed. Nothing from YouTube's player loads before the press. The player is on the
 * privacy-enhanced host and autoplays, because it only exists once the visitor pressed play. The
 * button is gone after the press, so focus moves to the player rather than falling to the page.
 * The box is always 16:9, so the swap never moves the page.
 */
@Component({
  selector: 'app-youtube-player',
  templateUrl: './youtube-player.component.html',
  styleUrl: './youtube-player.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YoutubePlayerComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly injector = inject(Injector);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly videoId = input.required<string>();
  /** The player's title, which names its frame for assistive technology. */
  readonly title = input.required<string>();
  /** The play button's accessible name. */
  readonly label = input.required<string>();
  /** Load the still at once, for the one in view on arrival; otherwise it loads as it nears the screen. */
  readonly eager = input(false);
  /** Whether the player has replaced the still. A parent can bind it to keep a video playing when the card is rebuilt. */
  readonly started = model(false);

  protected readonly thumbnailUrl = computed(() => `https://i.ytimg.com/vi/${this.videoId()}/hqdefault.jpg`);
  protected readonly embedUrl = computed(() =>
    this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube-nocookie.com/embed/${this.videoId()}?autoplay=1`),
  );

  protected play(): void {
    this.started.set(true);
    afterNextRender(() => this.element.nativeElement.querySelector('iframe')?.focus(), { injector: this.injector });
  }
}
