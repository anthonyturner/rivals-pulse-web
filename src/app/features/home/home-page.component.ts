import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { FeaturedContentComponent } from './featured-content/featured-content.component';
import { HeroSearchComponent } from './hero-search/hero-search.component';
import { HomeContentService } from './home-content.service';
import {
  buildHomeHeroMedia,
  buildSeasonHeroCopy,
  buildSeasonUpdateSpotlight,
} from './home-page-hero.utils';
import { SeasonDashboardComponent } from './season-dashboard/season-dashboard.component';
import { SeasonGlanceComponent } from './season-glance/season-glance.component';

const seasonLaunchPatchUrl = 'https://www.marvelrivals.com/20260708/41525_1306959.html';
/** Longest the hero video waits for an idle moment before starting anyway. */
const BACKGROUND_VIDEO_START_TIMEOUT_MS = 3000;
/** Fallback delay where requestIdleCallback is unavailable, such as Safari. */
const BACKGROUND_VIDEO_START_DELAY_MS = 1200;

@Component({
  selector: 'app-home-page',
  imports: [
    FeaturedContentComponent,
    HeroSearchComponent,
    RouterLink,
    SeasonDashboardComponent,
    SeasonGlanceComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements AfterViewInit {
  @ViewChild('heroBanner') private heroBanner?: ElementRef<HTMLElement>;
  @ViewChild('backgroundVideo') private backgroundVideo?: ElementRef<HTMLVideoElement>;

  backgroundVideoMuted = true;
  backgroundVideoForeground = false;
  backgroundVideoPoppedOut = false;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly homeContentService = inject(HomeContentService);
  readonly homeContent = toSignal(this.homeContentService.getHomeContent(), {
    initialValue: this.homeContentService.fallbackContent,
  });
  readonly latestPatchUrl = computed(
    () =>
      this.homeContent().latestNews.find((item) => item.label === 'Patch Notes')?.sourceUrl ??
      seasonLaunchPatchUrl,
  );
  readonly heroMedia = computed(() => buildHomeHeroMedia(this.homeContent()));
  readonly seasonHeroCopy = computed(() => buildSeasonHeroCopy(this.homeContent()));
  readonly seasonUpdateSpotlight = computed(() => buildSeasonUpdateSpotlight(this.homeContent()));

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.updateBackgroundVideoPopout();
      this.scheduleBackgroundVideoStart();
    }
  }

  /**
   * The hero video used to autoplay with preload="metadata", so it competed with
   * first paint for a decoration. The poster now carries the hero on its own and
   * the video is fetched once the browser is idle.
   */
  private scheduleBackgroundVideoStart(): void {
    const start = () => {
      const video = this.backgroundVideo?.nativeElement;

      if (!video) {
        return;
      }

      video.load();
      this.startBackgroundVideo(video);
    };

    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(start, { timeout: BACKGROUND_VIDEO_START_TIMEOUT_MS });
      return;
    }

    setTimeout(start, BACKGROUND_VIDEO_START_DELAY_MS);
  }

  @HostListener('window:scroll')
  updateBackgroundVideoPopout(): void {
    const hero = this.heroBanner?.nativeElement;

    if (!this.isBrowser || !hero || typeof hero.getBoundingClientRect !== 'function') {
      return;
    }

    this.backgroundVideoPoppedOut = hero.getBoundingClientRect().bottom <= 80;
  }

  startBackgroundVideo(video: HTMLVideoElement): void {
    video.muted = this.backgroundVideoMuted;
    video.defaultMuted = true;
    video.playsInline = true;

    void video.play().catch(() => {
      // The poster remains visible when a browser or user preference blocks autoplay.
    });
  }

  toggleBackgroundVideoSound(video: HTMLVideoElement): void {
    this.backgroundVideoMuted = !this.backgroundVideoMuted;
    video.muted = this.backgroundVideoMuted;

    if (!this.backgroundVideoMuted) {
      video.volume = 1;
    }

    void video.play().catch(() => {
      // The control remains available if playback needs another user gesture.
    });
  }

  onBackgroundVideoSurfaceClick(video: HTMLVideoElement): void {
    if (this.backgroundVideoForeground) {
      this.closeBackgroundVideo();
      return;
    }

    this.backgroundVideoForeground = true;
    void video.play().catch(() => {
      // Native foreground controls remain available if playback does not resume automatically.
    });
  }

  onBackgroundVideoKeydown(event: KeyboardEvent, video: HTMLVideoElement): void {
    if (this.backgroundVideoForeground || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    this.onBackgroundVideoSurfaceClick(video);
  }

  onForegroundVideoClick(event: MouseEvent): void {
    if (this.backgroundVideoForeground) {
      event.stopPropagation();
    }
  }

  syncBackgroundVideoSound(video: HTMLVideoElement): void {
    this.backgroundVideoMuted = video.muted;
  }

  closeBackgroundVideo(): void {
    this.backgroundVideoForeground = false;
  }

  @HostListener('document:keydown.escape')
  closeBackgroundVideoOnEscape(): void {
    if (this.backgroundVideoForeground) {
      this.closeBackgroundVideo();
    }
  }
}
