import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OVERLAY_FEATURES, OVERLAY_SCREENSHOTS, OverlaySectionComponent } from './overlay-section.component';

describe('OverlaySectionComponent', () => {
  let fixture: ComponentFixture<OverlaySectionComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(OverlaySectionComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Stops the Jarvis core's animation frame loop between specs.
    fixture.destroy();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('is a dark band labelled by its h2, "What the overlay does"', () => {
    const section = element.querySelector('section.band');
    const heading = element.querySelector('h2');

    expect(heading?.id).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(text(heading)).toBe('What the overlay does');
    expect(section?.classList).toContain('band--dark');
    expect(element.querySelectorAll('h2').length).toBe(1);
  });

  it('shows the Jarvis console, whose heading is an h3 under the section h2', () => {
    expect(element.querySelectorAll('app-jarvis-console').length).toBe(1);
    expect(element.querySelector('app-jarvis-console h3')?.id).toBe('jarvis-console-title');
    expect(element.querySelector('app-jarvis-console h2')).toBeNull();
  });

  describe('the feature cards', () => {
    it('shows six cards, each with an h3, a description and its default hotkeys', () => {
      const cards = Array.from(element.querySelectorAll('.feature'));

      expect(cards.length).toBe(6);
      expect(cards.map((card) => text(card.querySelector('h3')))).toEqual(OVERLAY_FEATURES.map((feature) => feature.title));
      expect(cards.every((card) => text(card.querySelector('p')).length > 0)).toBeTrue();
      expect(cards.map((card) => Array.from(card.querySelectorAll('kbd')).map(text))).toEqual(
        OVERLAY_FEATURES.map((feature) => [...feature.keys]),
      );
    });

    it('names only hotkeys the overlay manifest declares, and never the stale Ctrl+Shift+S', () => {
      const declared = ['I', 'T', 'E', 'P', 'O', 'R', 'H', 'M', 'K', 'W', 'B', 'U', 'X'];
      const keys = OVERLAY_FEATURES.flatMap((feature) => feature.keys);

      expect(keys.every((key) => /^Alt\+[A-Z]$/.test(key) && declared.includes(key.slice(4)))).toBeTrue();
      expect(text(element)).not.toMatch(/ctrl|shift/i);
    });

    it('keeps the cards as plain text: no links or buttons to focus or click', () => {
      expect(element.querySelectorAll('.feature a, .feature button').length).toBe(0);
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

    it('comes before the cards, and the cards before the Jarvis demo', () => {
      const shots = element.querySelector('.shots') as HTMLElement;
      const features = element.querySelector('.features') as HTMLElement;
      const jarvis = element.querySelector('app-jarvis-console') as HTMLElement;

      expect(shots.compareDocumentPosition(features) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(features.compareDocumentPosition(jarvis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });
});
