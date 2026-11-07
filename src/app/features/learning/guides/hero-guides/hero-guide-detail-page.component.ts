import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../../shared/components/eyebrow/eyebrow.component';
import { HeroImageFallbackDirective } from '../../../../shared/directives/hero-image-fallback.directive';
import { findHeroGuide } from './hero-guide-data';

@Component({
  selector: 'app-hero-guide-detail-page',
  imports: [EyebrowComponent, HeroImageFallbackDirective, RouterLink],
  templateUrl: './hero-guide-detail-page.component.html',
  styleUrls: ['../../../../shared/styles/guide-article.css', './hero-guide-detail-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroGuideDetailPageComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  readonly guide = computed(() => findHeroGuide(this.routeParams().get('heroId')));

  readonly sourceEmbedUrl = computed(() => this.youtubeEmbedUrl(this.guide()?.sourceUrl));

  private youtubeEmbedUrl(url?: string): SafeResourceUrl | null {
    const parsedUrl = url ? new URL(url) : null;
    const videoId = parsedUrl?.searchParams.get('v');

    if (!parsedUrl || !videoId) {
      return null;
    }

    const embedParams = new URLSearchParams();
    const start = parsedUrl.searchParams.get('t')?.replace(/\D/g, '');
    const playlist = parsedUrl.searchParams.get('list');

    if (start) {
      embedParams.set('start', start);
    }

    if (playlist) {
      embedParams.set('list', playlist);
    }

    const query = embedParams.toString();
    const embedUrl = `https://www.youtube.com/embed/${videoId}${query ? `?${query}` : ''}`;

    return this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl);
  }
}
