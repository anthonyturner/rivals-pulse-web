import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routes } from '../../../app.routes';
import { HOME_TOOLS, ToolsRowComponent } from './tools-row.component';

describe('ToolsRowComponent', () => {
  let fixture: ComponentFixture<ToolsRowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToolsRowComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolsRowComponent);
    fixture.detectChanges();
  });

  it('renders the tier list, team builder and guides, in that order', () => {
    const titles = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.tool h3')).map(
      (heading) => heading.textContent?.trim(),
    );

    expect(titles).toEqual(['Tier list', 'Team builder', 'Guides']);
  });

  it('shows an icon and a one-line promise on every card', () => {
    const cards: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('.tool'));

    expect(cards.length).toBe(HOME_TOOLS.length);
    cards.forEach((card, index) => {
      expect(card.querySelector('svg')).not.toBeNull();
      expect(card.querySelector('p')?.textContent?.trim()).toBe(HOME_TOOLS[index].promise);
    });
  });

  it('links each card with routerLink to its page', () => {
    const hrefs = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.tool')).map(
      (card) => card.getAttribute('href'),
    );

    expect(hrefs).toEqual(['/tier-list', '/team-builder', '/hero-guides']);
  });

  it('points only at routes the app declares', () => {
    const declared = new Set(routes.map((route) => `/${route.path}`));

    for (const tool of HOME_TOOLS) {
      expect(declared.has(tool.path)).withContext(`${tool.path} is a declared route`).toBeTrue();
    }
  });

  it('names no season, so the copy cannot go stale', () => {
    expect(fixture.nativeElement.textContent).not.toMatch(/season/i);
  });

  it('names the section by its heading', () => {
    const section: HTMLElement = fixture.nativeElement.querySelector('section');
    const heading: HTMLElement = fixture.nativeElement.querySelector('h2');

    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });
});
