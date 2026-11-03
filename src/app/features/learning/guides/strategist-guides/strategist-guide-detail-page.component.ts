import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { EyebrowComponent } from '../../../../shared/components/eyebrow/eyebrow.component';
import { NoticeComponent } from '../../../../shared/components/notice/notice.component';
import { StatePanelComponent } from '../../../../shared/components/state-panel/state-panel.component';
import { HeroImageFallbackDirective } from '../../../../shared/directives/hero-image-fallback.directive';
import { GuideCardComponent } from '../guide-card/guide-card.component';
import { videoUrlAt } from '../youtube-timestamp';
import { STRATEGIST_GUIDES } from './strategist-guides.data';

const RELATED_GUIDE_LIMIT = 3;

@Component({
  selector: 'app-strategist-guide-detail-page',
  imports: [
    EyebrowComponent,
    GuideCardComponent,
    HeroImageFallbackDirective,
    NoticeComponent,
    RouterLink,
    StatePanelComponent,
  ],
  templateUrl: './strategist-guide-detail-page.component.html',
  styleUrls: ['../../../../shared/styles/guide-article.css', './strategist-guide-detail-page.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StrategistGuideDetailPageComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly routeParams = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  readonly guide = computed(() => {
    const guideId = this.routeParams().get('guideId');

    return STRATEGIST_GUIDES.find((guide) => guide.id === guideId) ?? null;
  });

  readonly embedUrl = computed(() => {
    const guide = this.guide();

    return guide
      ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${guide.youtubeId}`)
      : null;
  });

  readonly videoUrl = computed(() => {
    const guide = this.guide();

    return guide ? `https://www.youtube.com/watch?v=${guide.youtubeId}` : null;
  });

  readonly checkpoints = computed(() => {
    const guide = this.guide();
    const videoUrl = this.videoUrl();

    if (!guide || !videoUrl) {
      return [];
    }

    return guide.checkpoints.map((checkpoint) => ({
      ...checkpoint,
      url: videoUrlAt(videoUrl, checkpoint.time),
    }));
  });

  readonly relatedGuides = computed(() => {
    const current = this.guide();

    return STRATEGIST_GUIDES.filter(
      (guide) => guide.id !== current?.id && guide.category === current?.category,
    )
      .slice(0, RELATED_GUIDE_LIMIT)
      .map((guide) => ({
        id: guide.id,
        title: guide.shortTitle,
        route: ['/strategist-guides', guide.id],
        imageUrl: guide.heroImage,
        caption: `${guide.category} · ${guide.heroFocus} · ${guide.duration}`,
      }));
  });
}
