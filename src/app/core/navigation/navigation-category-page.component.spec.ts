import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { NavigationCategoryPageComponent } from './navigation-category-page.component';
import { NAVIGATION_CATEGORIES } from './navigation-category.data';

describe('NavigationCategoryPageComponent', () => {
  function renderCategory(label: string): HTMLElement {
    const category = NAVIGATION_CATEGORIES.find((entry) => entry.label === label);

    TestBed.configureTestingModule({
      imports: [NavigationCategoryPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { category } } } },
      ],
    });

    const fixture = TestBed.createComponent(NavigationCategoryPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const texts = (nodes: NodeListOf<Element>): (string | undefined)[] =>
    Array.from(nodes).map((node) => node.textContent?.trim());

  it('is titled with the nav label and carries no slogan', () => {
    const element = renderCategory('Tools');

    expect(element.querySelector('h1')?.textContent).toBe('Tools');
    expect(element.querySelector('.description')?.textContent).toBe(
      'Check matchups and build a team before you queue.',
    );
  });

  it('shows the released tools as linked cards and the rest as plain text', () => {
    const element = renderCategory('Tools');
    const cards = element.querySelectorAll('app-guide-card a');

    expect(texts(cards)).toEqual(['Counters', 'Dive Planner', 'Team Builder']);
    expect(Array.from(cards).map((node) => node.getAttribute('href'))).toEqual(['/counters', '/dive-planner', '/team-builder']);
    expect(element.querySelector('app-guide-card img')).toBeNull();
    expect(texts(element.querySelectorAll('.soon strong'))).toEqual(['Learning Paths', 'Watch Next Quiz', 'AI Coach']);
    expect(element.querySelectorAll('.soon a, [aria-disabled]').length).toBe(0);
  });

  it('lists coming-soon items under one heading and drops "coming soon" from their descriptions', () => {
    const element = renderCategory('Tools');

    expect(element.querySelector('h2')?.textContent).toBe('Coming soon');
    expect(element.textContent).not.toContain('are coming soon');
    expect(element.textContent).not.toContain('is coming soon');
  });

  it('leaves out the coming-soon section when everything is released', () => {
    const element = renderCategory('Resources');

    expect(element.querySelector('h2')).toBeNull();
    expect(element.querySelectorAll('app-guide-card').length).toBe(8);
  });

  it('is not a landmark of its own and has no live region', () => {
    const element = renderCategory('Resources');

    expect(element.querySelector('main, [role="status"], [role="alert"], [aria-live]')).toBeNull();
  });
});

describe('category routes', () => {
  it('title each page after its nav label', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter(routes)] });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/resources');
    expect(document.title).toBe('Resources | RivalsPulse');

    await harness.navigateByUrl('/tools');
    expect(document.title).toBe('Tools | RivalsPulse');
  });
});
