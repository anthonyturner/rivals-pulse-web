import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OVERLAY_FEATURES, OVERLAY_SCREENSHOTS, OverlaySectionComponent } from './overlay-section.component';

describe('OverlaySectionComponent', () => {
  let fixture: ComponentFixture<OverlaySectionComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(OverlaySectionComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('is a themed light band labelled by its h2', () => {
    const section = element.querySelector('section.band');
    const heading = element.querySelector('h2');

    expect(heading?.id).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(text(heading)).toBe('The overlay does the work while you play');
    expect(section?.classList).not.toContain('band--white');
    expect(element.querySelectorAll('h2').length).toBe(1);
  });

  describe('the feature cards', () => {
    it('shows six cards, each with an h3 and a description, and no hotkeys or Pulsa demo', () => {
      const cards = Array.from(element.querySelectorAll('.feature'));

      expect(cards.length).toBe(6);
      expect(cards.map((card) => text(card.querySelector('h3')))).toEqual(OVERLAY_FEATURES.map((feature) => feature.title));
      expect(cards.every((card) => text(card.querySelector('p')).length > 0)).toBeTrue();
      expect(element.querySelectorAll('kbd, app-pulsa-console').length).toBe(0);
      expect(text(element)).not.toMatch(/alt\+|ctrl|hotkey|pulsa/i);
    });

    it('links only the card that carries on in the site, to Profile', () => {
      const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.feature a'));

      expect(links.map((link) => link.getAttribute('href'))).toEqual(['/profile']);
    });

    it('makes no rank claim, since the roster HUD shows players, not ranks', () => {
      const copy = OVERLAY_FEATURES.map((feature) => `${feature.title} ${feature.description}`).join(' ');

      expect(copy).not.toMatch(/\branks?\b|twelve|autostart/i);
    });
  });

  describe('the screenshots', () => {
    const images = (): HTMLImageElement[] => Array.from(element.querySelectorAll<HTMLImageElement>('.shot__image'));

    it('has width, height, descriptive alt text and lazy loading on every one', () => {
      expect(images().length).toBe(OVERLAY_SCREENSHOTS.length);

      for (const image of images()) {
        expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
        expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
        expect(image.alt.length).toBeGreaterThan(40);
        expect(image.getAttribute('loading')).toBe('lazy');
      }
    });

    it('points at images that are copies kept in this site, and puts no player name in the alt text', () => {
      expect(images().map((image) => image.getAttribute('src'))).toEqual([
        '/images/home/in-game-overlay-victory.jpg',
        '/images/home/in-game-overlay-domination.jpg',
      ]);
      expect(images().map((image) => image.alt).join(' ')).not.toMatch(/majila|karma|silentcoder|busiwater/i);
    });

    it('come after the cards', () => {
      const shots = element.querySelector('.shots') as HTMLElement;
      const features = element.querySelector('.features') as HTMLElement;

      expect(features.compareDocumentPosition(shots) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
