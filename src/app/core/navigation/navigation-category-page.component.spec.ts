import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { NavigationCategoryPageComponent } from './navigation-category-page.component';
import { NAVIGATION_CATEGORIES, type NavigationCategory } from './navigation-category.data';

describe('NavigationCategoryPageComponent', () => {
  function renderCategory(label: string, override?: NavigationCategory): HTMLElement {
    const category = override ?? NAVIGATION_CATEGORIES.find((entry) => entry.label === label);

    TestBed.configureTestingModule({
      imports: [NavigationCategoryPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
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

  it('shows the released tools as linked tiles', () => {
    const element = renderCategory('Tools');
    const links = element.querySelectorAll('app-hub-tile a');

    expect(texts(links)).toEqual(['Counters', 'Dive Planner', 'Team Builder']);
    expect(Array.from(links).map((node) => node.getAttribute('href'))).toEqual(['/counters', '/dive-planner', '/team-builder']);
  });

  it('leaves out pages that do not exist yet, and has no coming-soon section', () => {
    const element = renderCategory('Tools');
    const text = element.textContent ?? '';

    for (const label of ['Learning Paths', 'Watch Next Quiz', 'AI Coach']) {
      expect(text).not.toContain(label);
    }

    expect(text).not.toMatch(/coming soon/i);
  });

  it('draws every Resources item', () => {
    expect(renderCategory('Resources').querySelectorAll('app-hub-tile').length).toBe(9);
  });

  it('draws Resources and Tools as bento grids, each with its own tiles', () => {
    const resources = renderCategory('Resources');

    expect(resources.querySelector('app-hub-bento')).not.toBeNull();
    expect(resources.querySelector('app-guide-card')).toBeNull();
    expect(texts(resources.querySelectorAll('app-hub-tile h2'))[0]).toBe('Media Tutorials');

    TestBed.resetTestingModule();
    const tools = renderCategory('Tools');

    expect(tools.querySelector('app-hub-bento')).not.toBeNull();
    expect(tools.querySelector('app-guide-card')).toBeNull();
    expect(texts(tools.querySelectorAll('app-hub-tile h2'))[0]).toBe('Counters');
  });

  it('draws a hub with no tile config as plain cards', () => {
    const tools = NAVIGATION_CATEGORIES.find((entry) => entry.label === 'Tools') as NavigationCategory;
    const element = renderCategory('Tools', { ...tools, path: '/untiled' });

    expect(element.querySelector('app-hub-bento')).toBeNull();
    expect(element.querySelectorAll('app-guide-card').length).toBe(3);
  });

  it('is not a landmark of its own and has no live region', () => {
    const element = renderCategory('Resources');

    expect(element.querySelector('main, [role="status"], [role="alert"], [aria-live]')).toBeNull();
  });
});

describe('category routes', () => {
  it('title each page after its nav label', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/resources');
    expect(document.title).toBe('Resources | RivalsPulse');

    await harness.navigateByUrl('/tools');
    expect(document.title).toBe('Tools | RivalsPulse');
  });
});
