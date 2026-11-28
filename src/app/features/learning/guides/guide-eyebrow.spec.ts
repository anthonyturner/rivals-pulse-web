import { provideZonelessChangeDetection, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { BuildTheoryPageComponent } from './composition/build-theory/build-theory-page.component';
import { TripleSupportGuidePageComponent } from './composition/triple-support/triple-support-guide-page.component';
import { HERO_GUIDES } from './hero-guides/hero-guide-data';
import { HeroGuideDetailPageComponent } from './hero-guides/hero-guide-detail-page.component';
import { PowerPositionsPageComponent } from './positioning/power-positions/power-positions-page.component';
import { StrategicCoverPageComponent } from './positioning/strategic-cover/strategic-cover-page.component';

describe('guide page eyebrows', () => {
  function render<T>(page: Type<T>, heroId: string | null = null): HTMLElement {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: of(new Map([['heroId', heroId]])) } },
      ],
    });
    const fixture = TestBed.createComponent(page);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function expectEyebrowAboveH1(element: HTMLElement, label: string): void {
    const eyebrow = element.querySelector('app-eyebrow') as HTMLElement;

    expect(text(eyebrow)).toBe(label);
    expect(eyebrow.nextElementSibling?.tagName).toBe('H1');
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelectorAll('app-eyebrow').length).toBe(1);
  }

  it('names the role series above each hero guide title', () => {
    for (const guide of HERO_GUIDES.slice(0, 4)) {
      const element = render(HeroGuideDetailPageComponent, guide.heroId);

      expectEyebrowAboveH1(element, `${guide.role} guide`);
      expect(text(element.querySelector('h1'))).toBe(guide.heroName);
      expect(element.querySelector('.role')).toBeNull();
    }
  });

  it('names the positioning series on both positioning guides', () => {
    expectEyebrowAboveH1(render(PowerPositionsPageComponent), 'Positioning');
    expectEyebrowAboveH1(render(StrategicCoverPageComponent), 'Positioning');
  });

  it('names the composition series on both composition guides', () => {
    expectEyebrowAboveH1(render(BuildTheoryPageComponent), 'Composition');
    expectEyebrowAboveH1(render(TripleSupportGuidePageComponent), 'Composition');
  });
});
