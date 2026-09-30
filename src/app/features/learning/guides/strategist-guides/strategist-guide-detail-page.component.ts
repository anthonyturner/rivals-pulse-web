import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { STRATEGIST_GUIDES } from './strategist-guides.data';

@Component({
  selector: 'app-strategist-guide-detail-page',
  imports: [RouterLink],
  templateUrl: './strategist-guide-detail-page.component.html',
  styleUrl: './strategist-guide-detail-page.component.css',
})
export class StrategistGuideDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly routeParams = toSignal(this.route.paramMap);

  readonly guide = computed(() => {
    const guideId = this.routeParams()?.get('guideId');
    return STRATEGIST_GUIDES.find((guide) => guide.id === guideId) ?? null;
  });

  readonly embedUrl = computed(() => {
    const guide = this.guide();
    return guide
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${guide.youtubeId}`,
        )
      : null;
  });

  readonly relatedGuides = computed(() => {
    const current = this.guide();
    if (!current) {
      return [];
    }

    return STRATEGIST_GUIDES.filter(
      (guide) => guide.id !== current.id && guide.category === current.category,
    ).slice(0, 3);
  });

  videoUrl(time?: string): string {
    const guide = this.guide();
    if (!guide) {
      return 'https://www.youtube.com/';
    }

    const base = `https://www.youtube.com/watch?v=${guide.youtubeId}`;
    return time ? `${base}&t=${this.toSeconds(time)}s` : base;
  }

  private toSeconds(timestamp: string): number {
    return timestamp
      .split(':')
      .map(Number)
      .reduce((total, part) => total * 60 + part, 0);
  }
}
