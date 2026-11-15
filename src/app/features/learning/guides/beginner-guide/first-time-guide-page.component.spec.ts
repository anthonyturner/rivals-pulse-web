import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FirstTimeGuidePageComponent } from './first-time-guide-page.component';

describe('FirstTimeGuidePageComponent', () => {
  let fixture: ComponentFixture<FirstTimeGuidePageComponent>;
  let component: FirstTimeGuidePageComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FirstTimeGuidePageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FirstTimeGuidePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a full first time guide outline', () => {
    expect(component.sections.length).toBeGreaterThan(5);
    expect(component.quickRules).toContain('Fight with teammates.');
  });

  it('points the lede links at released pages only', () => {
    const element = fixture.nativeElement as HTMLElement;
    const targets = Array.from(element.querySelectorAll('.field-guide__header p a')).map((link) =>
      link.getAttribute('href'),
    );

    expect(targets).toEqual(['/beginner-interactive-guide', '/media-tutorials']);
  });

  it('is one article with a breadcrumb and a decorative portrait, and leaves the main landmark to the shell', () => {
    const element = fixture.nativeElement as HTMLElement;
    const crumbs = element.querySelector('nav[aria-label="Breadcrumb"]');

    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(crumbs?.querySelector('a')?.getAttribute('href')).toBe('/hero-guides');
    expect(crumbs?.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('First-time guide');
    expect(element.querySelector('img.field-guide__portrait')?.getAttribute('alt')).toBe('');
  });

  it('reads as prose chapters while keeping the genuine rules and first-match sequence as lists', () => {
    const element = fixture.nativeElement as HTMLElement;
    const rules = element.querySelectorAll('#five-rules ol li');
    const sections = element.querySelectorAll('section.field-guide__chapter:not(#five-rules)');

    expect(rules.length).toBe(component.quickRules.length);
    expect(sections.length).toBe(component.sections.length);
    expect(element.querySelector('.guide-tile, .guide-bullets')).toBeNull();
    expect(element.querySelectorAll('#first-match-plan ol li').length).toBe(4);
    expect(element.querySelector('#first-match-plan h2')?.textContent).toBe('Your first match plan');
    expect(element.querySelector('#worked-example')?.textContent).toContain('hypothetical practice');
    expect(element.querySelector('#next-match')?.textContent).toContain('one teammate');
  });

  it('gives every chapter link a matching destination', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'));

    expect(links.length).toBeGreaterThan(component.sections.length);
    for (const link of links) {
      const fragment = new URL(link.href).hash.slice(1);
      expect(element.querySelector(`[id="${fragment}"]`)).withContext(fragment).not.toBeNull();
    }
  });

  it('contains its article at narrow and desktop column widths in both themes', () => {
    const element = fixture.nativeElement as HTMLElement;
    const previousTheme = document.documentElement.dataset['theme'];
    element.style.display = 'block';

    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.dataset['theme'] = theme;
        for (const width of [320, 390, 884, 970]) {
          element.style.width = `${width}px`;
          const article = element.querySelector('article') as HTMLElement;
          expect(article.scrollWidth).withContext(`${theme}, ${width}px`).toBeLessThanOrEqual(article.clientWidth + 1);
        }
      }
    } finally {
      if (previousTheme === undefined) delete document.documentElement.dataset['theme'];
      else document.documentElement.dataset['theme'] = previousTheme;
    }
  });
});
