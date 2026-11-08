import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../shared/components/eyebrow/eyebrow.component';
import { ClosingCtaComponent } from './closing-cta/closing-cta.component';
import { GameNewsBandComponent } from './game-news-band/game-news-band.component';
import { HeroOverlayActionsComponent } from './hero-overlay-actions/hero-overlay-actions.component';
import { HomeFaqComponent } from './home-faq/home-faq.component';
import { HomeContentService } from './home-content.service';
import { HomeHeroVideoPreferenceService } from './home-hero-video-preference.service';
import { buildHomeHeroMedia } from './home-page-hero.utils';
import { HowItWorksComponent } from './how-it-works/how-it-works.component';
import { OverlaySectionComponent } from './overlay-section/overlay-section.component';
import { PulseBannerComponent, PulseBannerLayout } from './pulse-banner/pulse-banner.component';
import { ReleaseMediaOnDestroyDirective } from './release-media-on-destroy.directive';
import { ToolsRowComponent } from './tools-row/tools-row.component';
import { WordOfDayComponent } from './word-of-day/word-of-day.component';

/** Tells `styles.css` to leave room below the footer for the minimized tab, which would otherwise cover its last line. */
const RESERVE_CLASS = 'has-minimized-video';

/** What the visitor chose for the video once the hero has scrolled out of view. */
type FloatingVideoMode = 'floating' | 'minimized' | 'background';

/** Where the video is drawn: in the hero, in the floating player, folded into the tab, open as the dialog, or not at all. */
type VideoPlacement = 'hero' | 'floating' | 'minimized' | 'foreground' | 'off';

@Component({
  selector: 'app-home-page',
  imports: [
    ClosingCtaComponent,
    EyebrowComponent,
    GameNewsBandComponent,
    HeroOverlayActionsComponent,
    HomeFaqComponent,
    HowItWorksComponent,
    OverlaySectionComponent,
    PulseBannerComponent,
    ReleaseMediaOnDestroyDirective,
    RouterLink,
    ToolsRowComponent,
    WordOfDayComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements AfterViewInit {
  @ViewChild('heroBanner') private heroBanner?: ElementRef<HTMLElement>;
  @ViewChild('videoClose') private videoClose?: ElementRef<HTMLButtonElement>;
  @ViewChild('videoMinimize') private videoMinimize?: ElementRef<HTMLButtonElement>;
  @ViewChild('videoTab') private videoTab?: ElementRef<HTMLButtonElement>;
  private readonly backgroundVideo = viewChild<ElementRef<HTMLVideoElement>>('backgroundVideo');

  backgroundVideoMuted = true;
  private readonly foregroundOpen = signal(false);
  /** Held for the current visit only: a reload starts floating again. */
  private readonly floatingVideoMode = signal<FloatingVideoMode>('floating');
  private readonly heroScrolledPast = signal(false);
  private readonly heroVideoPreference = inject(HomeHeroVideoPreferenceService);
  /** Whether the visitor wants the hero video; with it off the Pulse banner is the hero's background. */
  readonly heroVideoOn = this.heroVideoPreference.enabled;
  readonly bannerLayout = computed<PulseBannerLayout>(() => (this.heroVideoOn() ? 'strip' : 'backdrop'));
  readonly videoPlacement = computed<VideoPlacement>(() => {
    const mode = this.floatingVideoMode();

    if (this.foregroundOpen()) {
      return 'foreground';
    }

    if (!this.heroVideoOn()) {
      return 'off';
    }

    return this.heroScrolledPast() && mode !== 'background' ? mode : 'hero';
  });
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  /** What had focus when the player opened, so closing it puts focus back where the visitor was. */
  private videoOpener: HTMLElement | null = null;
  private readonly homeContentService = inject(HomeContentService);
  readonly homeContent = toSignal(this.homeContentService.getHomeContent(), {
    initialValue: this.homeContentService.fallbackContent,
  });
  readonly heroMedia = computed(() => buildHomeHeroMedia(this.homeContent()));

  constructor() {
    if (this.isBrowser) {
      const root = this.document.documentElement;

      effect(() => root.classList.toggle(RESERVE_CLASS, this.videoPlacement() === 'minimized'));
      this.destroyRef.onDestroy(() => root.classList.remove(RESERVE_CLASS));
    }
  }

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

    const focused = this.document.activeElement;
    const before = this.videoPlacement();

    this.heroScrolledPast.set(hero.getBoundingClientRect().bottom <= 80);

    if (this.videoPlacement() !== before) {
      this.keepFocusInPage(focused);
    }
  }

  toggleHeroVideo(): void {
    const video = this.backgroundVideo()?.nativeElement;

    if (this.heroVideoOn() && video) {
      this.muteBackgroundVideo(video);
    }

    this.heroVideoPreference.set(!this.heroVideoOn());
  }

  minimizeFloatingVideo(video: HTMLVideoElement): void {
    this.muteBackgroundVideo(video);
    this.floatingVideoMode.set('minimized');
    afterNextRender(() => this.videoTab?.nativeElement.focus(), { injector: this.injector });
  }

  restoreFloatingVideo(): void {
    this.floatingVideoMode.set('floating');
    afterNextRender(() => this.videoMinimize?.nativeElement.focus(), { injector: this.injector });
  }

  sendVideoBackToBackground(video: HTMLVideoElement): void {
    const focused = this.document.activeElement;

    this.muteBackgroundVideo(video);
    this.floatingVideoMode.set('background');
    this.keepFocusInPage(focused);
  }

  /** A video the visitor can no longer see must not go on playing sound, and the sound toggle has scrolled away. */
  private muteBackgroundVideo(video: HTMLVideoElement): void {
    this.backgroundVideoMuted = true;
    video.muted = true;
  }

  /** A focused control that leaves the page would drop focus to the document body; the main landmark takes it instead. */
  private keepFocusInPage(focused: Element | null): void {
    afterNextRender(
      () => {
        if (focused && !focused.isConnected) {
          this.document.getElementById('main-content')?.focus({ preventScroll: true });
        }
      },
      { injector: this.injector },
    );
  }

  startBackgroundVideo(video: HTMLVideoElement): void {
    video.muted = this.backgroundVideoMuted;
    video.defaultMuted = true;
    video.playsInline = true;

    void video.play().catch(() => {
      // The poster remains visible when a browser or user preference blocks autoplay.
    });
  }

  toggleBackgroundVideoSound(): void {
    const video = this.backgroundVideo()?.nativeElement;

    if (!video) {
      return;
    }

    this.backgroundVideoMuted = !this.backgroundVideoMuted;
    video.muted = this.backgroundVideoMuted;

    if (!this.backgroundVideoMuted) {
      video.volume = 1;
    }

    void video.play().catch(() => {
      // The control remains available if playback needs another user gesture.
    });
  }

  onBackgroundVideoSurfaceClick(): void {
    if (this.foregroundOpen()) {
      this.closeBackgroundVideo();
      return;
    }

    this.openBackgroundVideo();
  }

  onWatchUpdateVideo(): void {
    if (!this.foregroundOpen()) {
      this.openBackgroundVideo();
    }
  }

  onBackgroundVideoKeydown(event: KeyboardEvent): void {
    if (this.foregroundOpen() || (event.key !== 'Enter' && event.key !== ' ')) {
      return;
    }

    event.preventDefault();
    this.onBackgroundVideoSurfaceClick();
  }

  onForegroundVideoClick(event: MouseEvent): void {
    if (this.foregroundOpen()) {
      event.stopPropagation();
    }
  }

  syncBackgroundVideoSound(video: HTMLVideoElement): void {
    this.backgroundVideoMuted = video.muted;
  }

  closeBackgroundVideo(): void {
    this.foregroundOpen.set(false);

    const opener = this.videoOpener;

    this.videoOpener = null;
    afterNextRender(
      () => {
        if (opener?.isConnected) {
          opener.focus();
        }
      },
      { injector: this.injector },
    );
  }

  /** The video is not in the page while the hero video is off, so it is rendered first when the update video opens. */
  private openBackgroundVideo(): void {
    this.videoOpener = this.isBrowser ? (this.document.activeElement as HTMLElement | null) : null;
    this.foregroundOpen.set(true);
    afterNextRender(
      () => {
        this.videoClose?.nativeElement.focus();
        void this.backgroundVideo()
          ?.nativeElement.play()
          .catch(() => {
            // Native foreground controls remain available if playback does not resume automatically.
          });
      },
      { injector: this.injector },
    );
  }

  @HostListener('document:keydown.escape')
  closeBackgroundVideoOnEscape(): void {
    if (this.foregroundOpen()) {
      this.closeBackgroundVideo();
    }
  }
}
