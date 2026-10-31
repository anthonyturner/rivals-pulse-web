import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { HERO_GUIDES, HeroGuide, HeroGuideImage } from './hero-guide-data';

@Component({
  selector: 'app-hero-guide-detail-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './hero-guide-detail-page.component.html',
  styleUrl: './hero-guide-detail-page.component.css',
})
export class HeroGuideDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  readonly guides = HERO_GUIDES;

  readonly guide = computed(() => {
    const heroId = this.route.snapshot.paramMap.get('heroId');

    return this.guides.find((guide) => guide.heroId === heroId) ?? this.guides[0];
  });

  readonly sourceEmbedUrl = computed(() => this.youtubeEmbedUrl(this.guide().sourceUrl));

  relatedImages(guide: HeroGuide): HeroGuideImage[] {
    if (guide.relatedImages?.length) {
      return guide.relatedImages;
    }

    if (guide.category === 'hero') {
      return [
        { src: guide.image, alt: guide.heroName, label: guide.role },
        ...this.roleImages(guide.role).slice(0, 3),
      ];
    }

    return this.roleImages(guide.role);
  }

  private roleImages(role: HeroGuide['role']): HeroGuideImage[] {
    switch (role) {
      case 'Vanguard':
        return [
          { src: '/images/heroes/magneto.png', alt: 'Magneto', label: 'Frontline' },
          { src: '/images/heroes/venom.png', alt: 'Venom', label: 'Dive tank' },
          { src: '/images/heroes/doctor-strange.png', alt: 'Doctor Strange', label: 'Shield space' },
          { src: '/images/heroes/captain-america.png', alt: 'Captain America', label: 'Disruption' },
        ];
      case 'Duelist':
        return [
          { src: '/images/heroes/psylocke.png', alt: 'Psylocke', label: 'Off-angle' },
          { src: '/images/heroes/star-lord.png', alt: 'Star-Lord', label: 'Pressure' },
          { src: '/images/heroes/black-panther.png', alt: 'Black Panther', label: 'Dive' },
          { src: '/images/heroes/hawkeye.png', alt: 'Hawkeye', label: 'Range' },
        ];
      case 'Strategist':
        return [
          { src: '/images/heroes/luna-snow.png', alt: 'Luna Snow', label: 'Sustain' },
          { src: '/images/heroes/mantis.png', alt: 'Mantis', label: 'Utility' },
          { src: '/images/heroes/loki.png', alt: 'Loki', label: 'Tempo' },
          { src: '/images/heroes/adam-warlock.png', alt: 'Adam Warlock', label: 'Revive' },
        ];
      default:
        return [
          { src: '/images/heroes/captain-america.png', alt: 'Captain America', label: 'Vanguard' },
          { src: '/images/heroes/psylocke.png', alt: 'Psylocke', label: 'Duelist' },
          { src: '/images/heroes/luna-snow.png', alt: 'Luna Snow', label: 'Strategist' },
          { src: '/images/heroes/doctor-strange.png', alt: 'Doctor Strange', label: 'Space' },
        ];
    }
  }

  private youtubeEmbedUrl(url?: string): SafeResourceUrl | undefined {
    if (!url) {
      return undefined;
    }

    const parsedUrl = new URL(url);
    const videoId = parsedUrl.searchParams.get('v') ?? '';

    if (!videoId) {
      return undefined;
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
