import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HubTileComponent } from './hub-tile.component';

describe('HubTileComponent', () => {
  function render(route: string | null): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HubTileComponent);
    fixture.componentRef.setInput('title', 'Alpha');
    fixture.componentRef.setInput('description', 'The first.');
    fixture.componentRef.setInput('route', route);
    fixture.detectChanges();

    return fixture.nativeElement;
  }

  it('makes the title a link to its route', () => {
    const element = render('/alpha');

    expect(element.querySelector('h2 a')?.getAttribute('href')).toBe('/alpha');
    expect(element.classList).not.toContain('static');
  });

  it('is plain text with no link, and marked static, when it has no route', () => {
    const element = render(null);

    expect(element.querySelector('h2')?.textContent?.trim()).toBe('Alpha');
    expect(element.querySelector('a')).toBeNull();
    expect(element.classList).toContain('static');
  });
});
