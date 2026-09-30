import { Component, computed, signal } from '@angular/core';

import { ReportHeroComponent } from '../../../shared/components/report-hero/report-hero.component';
import { FEATURED_CONTENT_SLIDES } from './featured-content.data';

@Component({
  selector: 'app-featured-content',
  imports: [ReportHeroComponent],
  templateUrl: './featured-content.component.html',
  styleUrl: './featured-content.component.css',
})
export class FeaturedContentComponent {
  readonly slides = FEATURED_CONTENT_SLIDES;
  readonly activeIndex = signal(0);
  readonly activeSlide = computed(() => this.slides[this.activeIndex()]);

  showPrevious(): void {
    this.activeIndex.update((index) => (index - 1 + this.slides.length) % this.slides.length);
  }

  showNext(): void {
    this.activeIndex.update((index) => (index + 1) % this.slides.length);
  }

  showSlide(index: number): void {
    this.activeIndex.set(index);
  }
}
