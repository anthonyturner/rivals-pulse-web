import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../../app.routes';
import { HERO_GUIDES } from '../hero-guides/hero-guide-data';
import { STRATEGIST_GUIDES } from '../strategist-guides/strategist-guides.data';
import { GUIDE_CATEGORIES } from './guide-library.data';
import { HeroGuidesPageComponent } from './hero-guides-page.component';

describe('HeroGuidesPageComponent', () => {
  let fixture: ComponentFixture<HeroGuidesPageComponent>;
  let element: HTMLElement;

  const links = () => Array.from(element.querySelectorAll<HTMLAnchorElement>('app-guide-card a'));
  const paths = () => links().map((link) => link.getAttribute('href'));
  const cards = () => Array.from(element.querySelectorAll<HTMLElement>('app-guide-card'));
  const headings = () => Array.from(element.querySelectorAll('.group h2'), (heading) => heading.textContent?.trim());
  const status = () => element.querySelector('[role="status"]')?.textContent?.trim();
  const input = () => element.querySelector<HTMLInputElement>('input[type="search"]');
  const clear = () => element.querySelector<HTMLButtonElement>('button.clear');
  const select = (label: string) => Array.from(element.querySelectorAll<HTMLSelectElement>('select'))
    .find((control) => control.closest('label')?.textContent?.trim().startsWith(label));

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function search(value: string): Promise<void> {
    const control = input();
    if (!control) throw new Error('Search input missing');
    control.value = value;
    control.dispatchEvent(new Event('input'));
    await settle();
  }

  async function choose(label: string, value: string): Promise<void> {
    const control = select(label);
    if (!control) throw new Error(`${label} select missing`);
    control.value = value;
    control.dispatchEvent(new Event('change'));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(HeroGuidesPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('lists every actual guide once at its existing address, including individual strategist lessons', () => {
    const expected = [
      ...HERO_GUIDES.map((guide) => `/hero-guides/${guide.heroId}`),
      ...STRATEGIST_GUIDES.map((guide) => `/strategist-guides/${guide.id}`),
      '/hero-guides/first-time',
      '/beginner-interactive-guide',
      '/techniques',
      '/power-positions',
      '/strategic-cover',
      '/build-theory',
      '/triple-support-counter',
    ];

    expect(paths().slice().sort()).toEqual(expected.sort());
    expect(new Set(paths()).size).toBe(expected.length);
    expect(status()).toBe(`${expected.length} guides`);
    expect(paths()).not.toContain('/stats/heroes');
    expect(paths()).not.toContain('/strategist-guides');
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('categorizes every guide, sorts titles within each category, and uses a clear heading hierarchy', () => {
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Guides');
    expect(headings()).toEqual([...GUIDE_CATEGORIES]);
    expect(element.querySelectorAll('app-guide-card h3').length).toBe(cards().length);
    expect(element.querySelector('app-guide-card h2')).toBeNull();

    for (const section of Array.from(element.querySelectorAll('.group'))) {
      const category = section.querySelector('h2')?.textContent?.trim() ?? '';
      const titles = Array.from(section.querySelectorAll('app-guide-card h3'), (title) => title.textContent?.trim() ?? '');
      expect(titles).toEqual(titles.slice().sort((a, b) => a.localeCompare(b)));
      for (const caption of Array.from(section.querySelectorAll('.caption'))) {
        expect(caption.textContent?.trim().startsWith(`${category} ·`)).toBeTrue();
      }
    }
  });

  it('visibly labels each native control and leaves initial focus alone', () => {
    expect(input()?.closest('label')?.querySelector('span')?.textContent).toBe('Search guides');
    expect(input()?.closest('label')?.querySelector('.visually-hidden')).toBeNull();
    expect(select('Category')).toBeDefined();
    expect(select('Hero')).toBeDefined();
    expect(clear()?.disabled).toBeTrue();
    expect(document.activeElement).not.toBe(input());
  });

  it('finds Doctor Strange with case and extra whitespace differences', async () => {
    await search('  DOCTOR    STRANGE  ');

    expect(paths()).toEqual(['/hero-guides/doctor-strange']);
    expect(status()).toBe('1 of 36 guides');
    expect(headings()).toEqual(['Hero guides']);
    expect(cards()[0].textContent).toContain('Vanguard');
  });

  it('matches multiword topics without requiring them to be a contiguous phrase', async () => {
    await choose('Category', 'Positioning');
    await search('ground   high');

    expect(paths()).toEqual(['/power-positions']);
    expect(status()).toBe('1 of 36 guides');
  });

  it('searches explicit strategist hero focus and punctuation variants', async () => {
    await search('cloak and dagger');

    expect(paths()).toEqual(['/strategist-guides/heal-vs-damage']);
    expect(cards()[0].textContent).toContain('Cloak & Dagger');
  });

  it('offers only heroes with explicit guide focus, sorted by name', () => {
    const options = Array.from(select('Hero')?.options ?? [], (option) => option.textContent);

    expect(options).toEqual([
      'All heroes', 'Captain America', 'Cloak & Dagger', 'Deadpool', 'Doctor Strange', 'Jubilee', 'Luna Snow', 'Rocket Raccoon',
    ]);
    expect(options).not.toContain('All Strategists');
    expect(options).not.toContain('Hawkeye');
    expect(options).not.toContain('Magneto');
  });

  it('does not mistake decorative artwork for a hero guide', async () => {
    await choose('Hero', 'Doctor Strange');

    expect(paths()).toEqual(['/hero-guides/doctor-strange']);
    expect(paths()).not.toContain('/build-theory');
    await choose('Hero', 'Captain America');
    expect(paths()).toEqual(['/hero-guides/captain-america']);
    expect(paths()).not.toContain('/hero-guides/first-time');
  });

  it('combines category, hero and topic filters without changing the available choices', async () => {
    const allHeroOptions = select('Hero')?.options.length;
    await choose('Category', 'Strategist lessons');
    await choose('Hero', 'Rocket Raccoon');
    await search('dealing damage');

    expect(paths()).toEqual(['/strategist-guides/rocket-guide-part-2-damage']);
    expect(status()).toBe('1 of 36 guides');
    expect(headings()).toEqual(['Strategist lessons']);
    expect(select('Hero')?.options.length).toBe(allHeroOptions);

    await choose('Category', 'Hero guides');
    expect(paths()).toEqual([]);
    expect(status()).toBe('0 of 36 guides');
  });

  it('counts filtered categories without duplicating live announcements', async () => {
    await choose('Category', 'Strategist lessons');

    expect(paths().length).toBe(STRATEGIST_GUIDES.length);
    expect(status()).toBe('10 of 36 guides');
    expect(element.querySelectorAll('[role="status"], [aria-live]').length).toBe(1);
    expect(select('Category')?.options.length).toBe(GUIDE_CATEGORIES.length + 1);
  });

  it('offers one useful empty state and resets all filters while returning focus to search', async () => {
    await choose('Category', 'Positioning');
    await choose('Hero', 'Doctor Strange');
    await search('no such guide');

    expect(paths().length).toBe(0);
    expect(status()).toBe('0 of 36 guides');
    expect(element.querySelector('app-state-panel h2')?.textContent).toBe('No guides match');
    expect(element.querySelector('app-state-panel')?.textContent).toContain('clear the filters above');
    expect(element.querySelectorAll('[role="status"], [aria-live]').length).toBe(1);
    expect(clear()?.disabled).toBeFalse();

    clear()?.click();
    await settle();

    expect(status()).toBe('36 guides');
    expect(paths().length).toBe(36);
    expect(input()?.value).toBe('');
    expect(select('Category')?.value).toBe('');
    expect(select('Hero')?.value).toBe('');
    expect(clear()?.disabled).toBeTrue();
    expect(document.activeElement).toBe(input());
  });

  it('keeps related hubs and statistics accessible without including them in guide results', async () => {
    await search('no such guide');
    const related = Array.from(element.querySelectorAll<HTMLAnchorElement>('nav.related a'));

    expect(related.map((link) => link.getAttribute('href'))).toEqual(['/strategist-guides', '/resources', '/stats/heroes']);
    expect(related.every((link) => Boolean(link.textContent?.trim()))).toBeTrue();
    expect(paths().length).toBe(0);
    expect(element.querySelector('main')).toBeNull();
  });

  it('keeps controls and cards inside narrow and sidebar-sized page columns in both themes', () => {
    const savedTheme = document.documentElement.getAttribute('data-theme');
    document.body.appendChild(element);

    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        for (const viewport of [320, 390, 1280, 1366]) {
          const column = viewport >= 1280 ? viewport - 332 : viewport;
          element.style.width = `${column}px`;
          const host = element.getBoundingClientRect();
          expect(element.scrollWidth).withContext(`${theme}, ${viewport}px viewport`).toBeLessThanOrEqual(column);
          for (const child of Array.from(element.querySelectorAll<HTMLElement>('.filters, input, select, .cards, app-guide-card'))) {
            const rect = child.getBoundingClientRect();
            expect(rect.left).withContext(`${theme}, ${viewport}px, ${child.tagName}`).toBeGreaterThanOrEqual(host.left - 1);
            expect(rect.right).withContext(`${theme}, ${viewport}px, ${child.tagName}`).toBeLessThanOrEqual(host.right + 1);
            expect(child.scrollWidth).withContext(`${theme}, ${viewport}px, ${child.tagName}`).toBeLessThanOrEqual(child.clientWidth + 1);
          }
        }
      }
    } finally {
      if (savedTheme === null) document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', savedTheme);
      element.remove();
    }
  });
});

describe('guide directory navigation', () => {
  it('opens the Doctor Strange guide from a search result using the existing route', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter(routes)] });
    const harness = await RouterTestingHarness.create('/hero-guides');
    const search = harness.routeNativeElement?.querySelector<HTMLInputElement>('input[type="search"]');
    if (!search) throw new Error('Guide directory search missing');
    search.value = 'Doctor Strange';
    search.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();
    harness.detectChanges();
    const result = harness.routeNativeElement?.querySelector<HTMLAnchorElement>('app-guide-card a');
    expect(result?.getAttribute('href')).toBe('/hero-guides/doctor-strange');

    result?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent?.trim()).toBe('Doctor Strange');
    expect(harness.routeNativeElement?.textContent).toContain('Infinitea');
    expect(harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a[href="https://www.youtube.com/watch?v=SWomAJspcoM&t=189s"]')?.href)
      .toBe('https://www.youtube.com/watch?v=SWomAJspcoM&t=189s');
  });
});
