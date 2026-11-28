import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HubTileComponent } from './hub-tile.component';

@Component({
  imports: [HubTileComponent],
  template: `
    <app-hub-tile title="Alpha" description="The first.">
      <a tile-actions href="/go">Go</a>
      <span>Preview</span>
    </app-hub-tile>
  `,
})
class ActionsHostComponent {}

describe('HubTileComponent', () => {
  const tokenOn = (element: Element, name: string): string => getComputedStyle(element).getPropertyValue(name).trim();

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

  it('keeps actions out of the hidden preview, which holds the rest of the content', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(ActionsHostComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('[aria-hidden="true"] a')).toBeNull();
    expect(element.querySelector('a[href="/go"]')?.textContent).toBe('Go');
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toContain('Preview');
  });

  it('remaps the text tokens to the ink tokens for the preview of a tile with key art, and not for a plain tile', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const create = (imageUrl: string | null) => {
      const fixture = TestBed.createComponent(HubTileComponent);
      fixture.componentRef.setInput('title', 'Alpha');
      fixture.componentRef.setInput('description', 'The first.');
      fixture.componentRef.setInput('imageUrl', imageUrl);
      fixture.detectChanges();

      return fixture.nativeElement as HTMLElement;
    };
    const featured = create('/images/site/banners/community-banner.webp');
    const plain = create(null);
    // Creating a second component removes the first one's root from the page, and a detached element has no computed style.
    document.body.append(featured, plain);
    const root = document.documentElement;
    const theme = root.dataset['theme'];
    // The light theme is where the text tokens differ from the ink ones.
    root.dataset['theme'] = 'light';
    const previewOf = (tile: HTMLElement): Element => tile.querySelector('.preview') as Element;

    try {
      expect(tokenOn(root, '--text')).not.toBe(tokenOn(root, '--on-ink'));
      expect(tokenOn(previewOf(featured), '--text-muted')).toBe(tokenOn(root, '--on-ink-muted'));
      expect(tokenOn(previewOf(featured), '--text')).toBe(tokenOn(root, '--on-ink'));
      expect(tokenOn(previewOf(plain), '--text-muted')).toBe(tokenOn(root, '--text-muted'));
      expect(tokenOn(previewOf(plain), '--text')).toBe(tokenOn(root, '--text'));
    } finally {
      if (theme === undefined) {
        delete root.dataset['theme'];
      } else {
        root.dataset['theme'] = theme;
      }
      featured.remove();
      plain.remove();
    }
  });
});
