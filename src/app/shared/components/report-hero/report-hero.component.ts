import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

export interface ReportHeroAction {
  label: string;
  routerLink?: string;
  href?: string;
  primary?: boolean;
  accessibleLabel?: string;
}

export interface ReportHeroMedia {
  kind: 'image' | 'video';
  title: string;
  label: string;
  meta: string;
  imageUrl?: string;
  imageAlt?: string;
  videoId?: string;
}

@Component({
  selector: 'app-report-hero',
  imports: [RouterLink],
  templateUrl: './report-hero.component.html',
  styleUrl: './report-hero.component.css',
})
export class ReportHeroComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input.required<string>();
  readonly actions = input<readonly ReportHeroAction[]>([]);
  readonly media = input<ReportHeroMedia | null>(null);
  readonly sourceNote = input('');
  readonly headingLevel = input<1 | 2 | 3>(1);
  readonly variant = input<'page' | 'card'>('page');

  readonly videoEmbedUrl = computed(() => {
    const media = this.media();

    return media?.kind === 'video' && media.videoId
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${media.videoId}`,
        )
      : null;
  });
}
