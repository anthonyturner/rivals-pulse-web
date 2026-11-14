import { Directive, ElementRef, inject } from '@angular/core';

export const DEFAULT_HERO_IMAGE = '/images/heroes/default-hero.png';

/** Swaps an image that fails to load for the default hero portrait, so its box keeps its size. */
@Directive({
  selector: 'img[appHeroImageFallback]',
  host: { '(error)': 'useFallback()' },
})
export class HeroImageFallbackDirective {
  private readonly image = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;

  protected useFallback(): void {
    if (!this.image.src.endsWith(DEFAULT_HERO_IMAGE)) {
      this.image.src = DEFAULT_HERO_IMAGE;
    }
  }
}
