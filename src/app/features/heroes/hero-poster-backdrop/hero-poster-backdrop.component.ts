import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

import { HeroPosterBackdropPreferenceService } from './hero-poster-backdrop-preference.service';

/** The art behind the hero poster: the portrait, or the hero's gameplay video when the visitor switches it on. */
@Component({
  selector: 'app-hero-poster-backdrop',
  templateUrl: './hero-poster-backdrop.component.html',
  styleUrl: './hero-poster-backdrop.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroPosterBackdropComponent {
  private readonly preference = inject(HeroPosterBackdropPreferenceService);

  readonly heroName = input.required<string>();
  readonly imageUrl = input.required<string>();
  /** A muted, looping background embed; null when the hero has no gameplay video of their own. */
  readonly videoUrl = input<SafeResourceUrl | null>(null);

  protected readonly playing = computed(() => this.videoUrl() !== null && this.preference.backdrop() === 'video');

  /** The portrait stays visible until the player has loaded, so switching never flashes an empty frame. */
  protected readonly videoLoaded = linkedSignal({ source: this.videoUrl, computation: () => false });

  protected toggle(): void {
    this.preference.set(this.playing() ? 'portrait' : 'video');
  }
}
