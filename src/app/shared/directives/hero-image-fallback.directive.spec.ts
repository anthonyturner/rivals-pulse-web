import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { DEFAULT_HERO_IMAGE, HeroImageFallbackDirective } from './hero-image-fallback.directive';

@Component({
  imports: [HeroImageFallbackDirective],
  template: '<img appHeroImageFallback src="/images/heroes/missing.png" alt="" />',
})
class HostComponent {}

describe('HeroImageFallbackDirective', () => {
  let image: HTMLImageElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    image = fixture.nativeElement.querySelector('img');
  });

  it('shows the default portrait when the image fails', () => {
    image.dispatchEvent(new Event('error'));

    expect(image.getAttribute('src')).toBe(DEFAULT_HERO_IMAGE);
  });

  it('does not set the source again when the default portrait itself fails, which would fire error again', () => {
    image.dispatchEvent(new Event('error'));
    const setSource = spyOnProperty(HTMLImageElement.prototype, 'src', 'set');

    image.dispatchEvent(new Event('error'));

    expect(setSource).not.toHaveBeenCalled();
  });
});
