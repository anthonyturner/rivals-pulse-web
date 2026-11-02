import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routes } from '../../../app.routes';
import { NAVIGATION_CATEGORIES } from '../../../core/navigation/navigation-category.data';
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

  const cards = (): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll('.tool'));
  const flat = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('renders six cards, in order, each with one h3', () => {
    expect(cards().map((card) => flat(card.querySelector('h3')))).toEqual([
      'Hero stats',
      'Tier list',
      'Counters',
      'Team builder',
      'Heroes',
      'Guides',
    ]);
  });

  it('shows an icon, a one-line promise and a named action on every card', () => {
    expect(cards().length).toBe(HOME_TOOLS.length);
    cards().forEach((card, index) => {
      expect(card.querySelector('svg')).not.toBeNull();
      expect(flat(card.querySelector('.tool__promise'))).toBe(HOME_TOOLS[index].promise);
      expect(flat(card.querySelector('.tool__action'))).toBe(`${HOME_TOOLS[index].action}→`);
    });
  });

  it('links each card with routerLink to its page', () => {
    expect(cards().map((card) => card.getAttribute('href'))).toEqual([
      '/community',
      '/tier-list',
      '/counters',
      '/team-builder',
      '/heroes',
      '/hero-guides',
    ]);
  });

  it('has one focusable link per card and nothing else to tab to', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('a, button').length).toBe(6);
  });

  it('points only at routes the app declares', () => {
    const declared = new Set(routes.map((route) => `/${route.path}`));

    for (const tool of HOME_TOOLS) {
      expect(declared.has(tool.path)).withContext(`${tool.path} is a declared route`).toBeTrue();
    }
  });

  it('points at no page the navigation marks as coming soon', () => {
    const disabled = new Set(
      NAVIGATION_CATEGORIES.flatMap((category) => category.items)
        .filter((item) => !item.enabled)
        .map((item) => item.path),
    );

    for (const tool of HOME_TOOLS) {
      expect(disabled.has(tool.path)).withContext(`${tool.path} is released`).toBeFalse();
    }
  });

  describe('the In the app lines', () => {
    it('say what the app does with the same answer in game, with no hotkey', () => {
      const lines = Object.fromEntries(
        cards().map((card) => [flat(card.querySelector('h3')), flat(card.querySelector('.tool__overlay'))]),
      );

      expect(lines).toEqual({
        'Hero stats': 'In the app Every match you play with the app adds to these numbers.',
        'Tier list': 'In the app Open the tier list over the game.',
        Counters: 'In the app Search counters without leaving the match.',
        'Team builder': '',
        Heroes: 'In the app Look up any hero mid-match.',
        Guides: '',
      });
      expect(fixture.nativeElement.querySelectorAll('kbd').length).toBe(0);
      expect(fixture.nativeElement.textContent).not.toMatch(/alt\+|ctrl|hotkey/i);
    });

    it('are left out for the team builder and the guides, which have no counterpart', () => {
      expect(HOME_TOOLS.filter((tool) => !tool.inOverlay).map((tool) => tool.title)).toEqual([
        'Team builder',
        'Guides',
      ]);
    });
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
