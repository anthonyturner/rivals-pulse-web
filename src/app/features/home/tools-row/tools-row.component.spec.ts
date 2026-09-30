import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HOME_TOOLS, ToolsRowComponent } from './tools-row.component';
import { routes } from '../../../app.routes';

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

  it('renders a tile per tool, with its promise and action', () => {
    const tiles = fixture.nativeElement.querySelectorAll('.tool');

    expect(tiles.length).toBe(HOME_TOOLS.length);
    expect(tiles.length).toBe(4);

    HOME_TOOLS.forEach((tool, index) => {
      const tile = tiles[index];

      expect(tile.querySelector('h3').textContent.trim()).toBe(tool.title);
      expect(tile.querySelector('p').textContent.trim()).toBe(tool.promise);
      expect(tile.querySelector('.tool-action').textContent).toContain(tool.action);
    });
  });

  it('links each tile with routerLink, not a raw href', () => {
    const tiles = fixture.nativeElement.querySelectorAll('.tool');

    HOME_TOOLS.forEach((tool, index) => {
      // RouterLink resolves to the same href, which is what proves it is routed.
      expect(tiles[index].getAttribute('href')).toBe(tool.path);
    });
  });

  it('points only at routes the app actually declares', () => {
    const declared = new Set(routes.map((route) => `/${route.path}`));

    for (const tool of HOME_TOOLS) {
      expect(declared.has(tool.path))
        .withContext(`${tool.path} is a declared route`)
        .toBeTrue();
    }
  });

  it('keeps the copy season-agnostic so it cannot go stale', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).not.toMatch(/Season\s+\d+/i);
  });

  it('gives the section an accessible name', () => {
    const section = fixture.nativeElement.querySelector('section');
    const heading = fixture.nativeElement.querySelector('h2');

    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });
});
