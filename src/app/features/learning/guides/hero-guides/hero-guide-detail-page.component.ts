import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../../shared/components/eyebrow/eyebrow.component';
import { GuideChaptersComponent } from '../../../../shared/components/guide-chapters/guide-chapters.component';
import type { GuideChapter } from '../../../../shared/components/guide-chapters/guide-chapters.types';
import { HeroImageFallbackDirective } from '../../../../shared/directives/hero-image-fallback.directive';
import { findHeroGuide } from './hero-guide-data';

@Component({
  selector: 'app-hero-guide-detail-page',
  imports: [EyebrowComponent, GuideChaptersComponent, HeroImageFallbackDirective, RouterLink],
  templateUrl: './hero-guide-detail-page.component.html',
  styleUrls: ['../../../../shared/styles/field-guide.css', './hero-guide-detail-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroGuideDetailPageComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  readonly guide = computed(() => findHeroGuide(this.routeParams().get('heroId')));

  readonly sections = computed(() => this.guide()?.sections.map((section, index) => ({
    ...section,
    id: `chapter-${index + 1}`,
    number: String(index + 1).padStart(2, '0'),
  })) ?? []);

  readonly chapters = computed<readonly GuideChapter[]>(() => {
    const guide = this.guide();
    const chapters: GuideChapter[] = this.sections().map(({ id, title }) => ({ id, title }));

    if (guide?.workedExample) chapters.push({ id: 'worked-example', title: 'Worked example' });
    if (guide?.practiceFocus) chapters.push({ id: 'next-match', title: 'Try this next match' });
    if (guide && guide.ultimates.length > 0) chapters.push({ id: 'ultimates', title: 'Ultimates and matchups' });
    chapters.push({ id: 'sources', title: 'Sources and further reading' });

    return chapters;
  });

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
