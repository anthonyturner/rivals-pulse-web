import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HERO_GUIDES } from '../hero-guides/hero-guide-data';
import { GUIDE_SECTIONS, guideTileSizes } from './guide-library.data';
import { HeroGuidesPageComponent } from './hero-guides-page.component';

describe('HeroGuidesPageComponent', () => {
  let element: HTMLElement;

  const links = () => Array.from(element.querySelectorAll('app-hub-tile a'));
  const sections = () => Array.from(element.querySelectorAll('section'));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HeroGuidesPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('is titled Guides, with the groups as headings under it', () => {
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Guides');
    expect(Array.from(element.querySelectorAll('h2'), (heading) => heading.textContent?.trim())).toEqual([
      'Start here',
      'Hero guides',
      'Fundamentals',
      'Habits and team play',
      'Strategist lessons',
    ]);
  });

  it('titles each guide with an h3 under its group heading', () => {
    expect(element.querySelectorAll('app-hub-tile h2').length).toBe(0);
    expect(element.querySelectorAll('app-hub-tile h3').length).toBe(27);
  });

  it('gives every guide link its own name', () => {
    const names = links().map((link) => link.textContent?.trim());

    expect(names.length).toBe(27);
    expect(new Set(names).size).toBe(names.length);
  });

  it('lists every guide once, each under its group, going to its own address', () => {
    const hrefsByGroup = sections().map((section) =>
      Array.from(section.querySelectorAll('app-hub-tile a'), (link) => link.getAttribute('href')),
    );

    expect(hrefsByGroup.map((hrefs) => hrefs.length)).toEqual([3, 3, 14, 6, 1]);
    expect(hrefsByGroup[0]).toContain('/hero-guides/coach-mills-ultimate-beginners-guide');
    expect(hrefsByGroup[0]).toContain('/hero-guides/first-time');
    expect(hrefsByGroup[0]).toContain('/beginner-interactive-guide');
    expect(hrefsByGroup[1]).toEqual(
      HERO_GUIDES.filter((guide) => guide.category === 'hero').map((guide) => `/hero-guides/${guide.heroId}`),
    );
    expect(hrefsByGroup[3]).toContain('/win-rates');
    expect(new Set(hrefsByGroup.flat()).size).toBe(27);
  });

  it('lists the tempo and ultimate economy guide under its own address', () => {
    expect(links().map((link) => link.getAttribute('href'))).toContain('/hero-guides/tempo-and-ultimate-economy');
  });

  it('links the strategist lessons', () => {
    expect(links().map((link) => link.getAttribute('href'))).toContain('/strategist-guides');
  });

  it('leads each group with its first guide as key art, and shows the rest with thumbnails', () => {
    for (const section of sections()) {
      const tiles = Array.from(section.querySelectorAll('app-hub-tile'));

      expect(tiles[0].querySelectorAll('.art__image').length).toBe(1);
      expect(tiles[0].querySelector('img.thumbnail')).toBeNull();
      for (const tile of tiles.slice(1)) {
        expect(tile.querySelector('.art__image')).toBeNull();
        expect(tile.querySelectorAll('img.thumbnail').length).toBe(1);
      }
    }
  });

  it('tints a hero playbook chip by its role and a fundamentals chip with the accent', () => {
    const chipKinds = (section: Element) => Array.from(section.querySelectorAll('.chip'), (chip) => chip.getAttribute('data-kind'));
    const roles = new Map(HERO_GUIDES.map((guide) => [guide.heroName, guide.role]));
    const heroTiles = Array.from(sections()[1].querySelectorAll('app-hub-tile'));

    expect(heroTiles.length).toBeGreaterThan(0);
    for (const tile of heroTiles) {
      const role = roles.get(tile.querySelector('a')?.textContent?.trim() ?? '');
      const expected = { Vanguard: 'secondary', Duelist: 'tertiary', Strategist: 'accent', Fundamentals: 'accent' }[role ?? 'Fundamentals'];

      expect(tile.querySelector('.chip')?.getAttribute('data-kind')).toBe(expected);
    }
    expect(new Set(chipKinds(sections()[2]))).toEqual(new Set(['accent']));
    expect(chipKinds(sections()[4])).toEqual(['accent']);
  });

  it('leaves the main landmark to the shell and has an h1', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('h1')).not.toBeNull();
  });
});

describe('guideTileSizes', () => {
  const columns = { feature: 4, tall: 2, half: 3, third: 2, note: 2, wide: 6 } as const;

  it('gives a single guide the whole row and no guides nothing', () => {
    expect(guideTileSizes(0)).toEqual([]);
    expect(guideTileSizes(1)).toEqual(['wide']);
  });

  it('puts a tall tile beside the lead when there are two guides', () => {
    expect(guideTileSizes(2)).toEqual(['feature', 'tall']);
  });

  it('leads with a feature tile and fills every row of the six-column grid, whatever the count', () => {
    for (let count = 3; count <= 30; count++) {
      const sizes = guideTileSizes(count);
      const [lead, besideA, besideB, ...rest] = sizes;
      const restColumns = rest.reduce((total, size) => total + columns[size], 0);

      expect(sizes.length).toBe(count);
      expect([lead, besideA, besideB]).toEqual(['feature', 'third', 'third']);
      expect(restColumns % 6).toBe(0);
    }
  });

  it('sizes each of the Guides hub groups to its guide count', () => {
    for (const section of GUIDE_SECTIONS) {
      expect(section.tiles.map((tile) => tile.size)).toEqual(guideTileSizes(section.links.length));
    }
  });
});
