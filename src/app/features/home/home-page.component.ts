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

import { HeroOverlayActionsComponent } from './hero-overlay-actions/hero-overlay-actions.component';
import { HomeContentService } from './home-content.service';
import { JarvisConsoleComponent } from './jarvis-console/jarvis-console.component';
import { buildHomeHeroMedia, buildSeasonUpdateSpotlight } from './home-page-hero.utils';
import { SeasonDashboardComponent } from './season-dashboard/season-dashboard.component';
import { SeasonGlanceComponent } from './season-glance/season-glance.component';
import { StatsSnapshotComponent } from './stats-snapshot/stats-snapshot.component';
import { ToolsRowComponent } from './tools-row/tools-row.component';

@Component({
  selector: 'app-home-page',
  imports: [
    HeroOverlayActionsComponent,
    JarvisConsoleComponent,
    SeasonDashboardComponent,
    SeasonGlanceComponent,
    StatsSnapshotComponent,
    ToolsRowComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements AfterViewInit {
  @ViewChild('heroBanner') private heroBanner?: ElementRef<HTMLElement>;

  backgroundVideoMuted = true;
  backgroundVideoForeground = false;
  backgroundVideoPoppedOut = false;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly homeContentService = inject(HomeContentService);
  readonly homeContent = toSignal(this.homeContentService.getHomeContent(), {
    initialValue: this.homeContentService.fallbackContent,
  });
  readonly heroMedia = computed(() => buildHomeHeroMedia(this.homeContent()));
  readonly seasonUpdateSpotlight = computed(() => buildSeasonUpdateSpotlight(this.homeContent()));

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      this.updateBackgroundVideoPopout();
    }
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
