import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';

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

  it('lists the released tools first and the unreleased ones last', () => {
    const element = renderCategory('Tools');
    const labels = Array.from(element.querySelectorAll('.category-card strong')).map(
      (node) => node.textContent?.trim(),
    );

    expect(labels).toEqual(['Counters', 'Team Builder', 'Learning Paths', 'Watch Next Quiz', 'AI Coach']);
  });

  it('marks unreleased tools as coming soon instead of linking to them', () => {
    const element = renderCategory('Tools');
    const disabledLabels = Array.from(element.querySelectorAll('.category-card.is-disabled strong')).map(
      (node) => node.textContent?.trim(),
    );
    const linkTargets = Array.from(element.querySelectorAll('a.category-card')).map((node) =>
      node.getAttribute('href'),
    );

    expect(disabledLabels).toEqual(['Learning Paths', 'Watch Next Quiz', 'AI Coach']);
    expect(element.querySelectorAll('.category-card.is-disabled .coming-soon').length).toBe(3);
    expect(linkTargets).toEqual(['/counters', '/team-builder']);
  });
});
