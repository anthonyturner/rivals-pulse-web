import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HubLink, HubTileConfig } from '../hub-tile.types';
import { HubBentoComponent } from './hub-bento.component';

@Component({ selector: 'app-test-preview', template: '<span class="test-preview">Preview</span>', changeDetection: ChangeDetectionStrategy.OnPush })
class TestPreviewComponent {}

const LINKS: HubLink[] = [
  { label: 'Alpha', path: '/alpha', description: 'The first.' },
  { label: 'Beta', path: '/beta', description: 'The second.' },
  { label: 'Gamma', path: '/gamma', description: 'The third.' },
];

describe('HubBentoComponent', () => {
  function render(links: readonly HubLink[], config: readonly HubTileConfig[]): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HubBentoComponent);
    fixture.componentRef.setInput('links', links);
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();

    return fixture.nativeElement;
  }

  const titles = (element: HTMLElement): (string | undefined)[] =>
    Array.from(element.querySelectorAll('h2')).map((heading) => heading.textContent?.trim());

  it('lays the tiles out as the config it is given orders them, whatever order the links come in', () => {
    const element = render(LINKS, [
      { path: '/gamma', size: 'feature', chip: null, preview: null, imageUrl: null },
      { path: '/alpha', size: 'wide', chip: null, preview: null, imageUrl: null },
      { path: '/beta', size: 'half', chip: null, preview: null, imageUrl: null },
    ]);

    expect(titles(element)).toEqual(['Gamma', 'Alpha', 'Beta']);
    expect(Array.from(element.querySelectorAll('.cell')).map((cell) => cell.getAttribute('data-size'))).toEqual([
      'feature',
      'wide',
      'half',
    ]);
  });

  it('draws the preview component the config names inside its tile, and none for a tile without one', () => {
    const element = render(LINKS, [
      { path: '/alpha', size: 'half', chip: null, preview: TestPreviewComponent, imageUrl: null },
      { path: '/beta', size: 'half', chip: null, preview: null, imageUrl: null },
    ]);
    const tiles = Array.from(element.querySelectorAll('app-hub-tile'));

    expect(tiles[0].querySelector('.preview .test-preview')).not.toBeNull();
    expect(tiles[1].querySelector('.test-preview')).toBeNull();
    expect(element.querySelectorAll('.test-preview').length).toBe(1);
  });

  it('gives a link the config does not name a plain tile after the others', () => {
    const element = render(LINKS, [{ path: '/beta', size: 'wide', chip: null, preview: null, imageUrl: null }]);

    expect(titles(element)).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(Array.from(element.querySelectorAll('.cell')).map((cell) => cell.getAttribute('data-size'))).toEqual([
      'wide',
      'third',
      'third',
    ]);
  });

  it('passes a tile its tint and its strip layout', () => {
    const element = render(LINKS, [
      { path: '/alpha', size: 'feature', chip: null, preview: null, imageUrl: null, tint: 'danger' },
      { path: '/beta', size: 'wide', chip: null, preview: null, imageUrl: null, split: true },
    ]);
    const [alpha, beta, gamma] = Array.from(element.querySelectorAll('app-hub-tile'));

    expect(alpha.getAttribute('data-tint')).toBe('danger');
    expect(alpha.classList).not.toContain('split');
    expect(beta.classList).toContain('split');
    expect(beta.getAttribute('data-tint')).toBeNull();
    expect(gamma.getAttribute('data-tint')).toBeNull();
  });
});
