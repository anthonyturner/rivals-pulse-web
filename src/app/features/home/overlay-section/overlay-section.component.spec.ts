import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OVERLAY_FEATURES, OverlaySectionComponent } from './overlay-section.component';

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

  it('is a labelled section whose h2 is "What the overlay does"', () => {
    const section = element.querySelector('section.overlay-section');
    const heading = element.querySelector('h2');

    expect(heading?.id).toBeTruthy();
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(text(heading)).toBe('What the overlay does');
    expect(element.querySelectorAll('h2').length).toBe(1);
  });

  it('shows the Jarvis console, whose heading is an h3 under the section h2', () => {
    expect(element.querySelectorAll('app-jarvis-console').length).toBe(1);
    expect(element.querySelector('app-jarvis-console h3')?.id).toBe('jarvis-console-title');
    expect(element.querySelector('app-jarvis-console h2')).toBeNull();
  });

  it('shows exactly three feature tiles, each with an h3 and a description', () => {
    const tiles = Array.from(element.querySelectorAll('.feature'));

    expect(tiles.length).toBe(3);
    expect(tiles.map((tile) => text(tile.querySelector('h3')))).toEqual(OVERLAY_FEATURES.map((feature) => feature.title));
    expect(tiles.every((tile) => text(tile.querySelector('p')).length > 0)).toBeTrue();
  });

  it('keeps the tiles as plain text: no links or buttons to focus or click', () => {
    expect(element.querySelectorAll('.feature a, .feature button').length).toBe(0);
  });

  it('names no hotkey, which is not checked against the overlay', () => {
    const copy = OVERLAY_FEATURES.map((feature) => `${feature.title} ${feature.description}`).join(' ');

    expect(copy).not.toMatch(/\bAlt\b|\bCtrl\b|\bF\d{1,2}\b|hotkey|shortcut/i);
  });
});
