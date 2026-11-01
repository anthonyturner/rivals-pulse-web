import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { HERO_GUIDES } from './hero-guide-data';
import { HeroGuideDetailPageComponent } from './hero-guide-detail-page.component';

describe('HeroGuideDetailPageComponent', () => {
  const params = new BehaviorSubject(convertToParamMap({ heroId: 'captain-america' }));
  let fixture: ComponentFixture<HeroGuideDetailPageComponent>;
  let element: HTMLElement;

  async function open(heroId: string): Promise<void> {
    params.next(convertToParamMap({ heroId }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    params.next(convertToParamMap({ heroId: 'captain-america' }));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    fixture = TestBed.createComponent(HeroGuideDetailPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('shows the guide for the id in the address', () => {
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Captain America');
  });

  it('follows the address when the id changes', async () => {
    await open('jubilee');

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Jubilee');
  });

  it('says the guide is not found for an unknown id instead of showing another guide', async () => {
    await open('nope');

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Guide not found');
    expect(element.querySelector('app-state-panel')?.getAttribute('role')).toBe('status');
    expect(element.querySelector('a[href="/hero-guides"]')).not.toBeNull();
    expect(element.textContent).not.toContain(HERO_GUIDES[0].heroName);
  });

  it('shows each section as a card with plain bullets', () => {
    expect(element.querySelectorAll('.guide-tile h2').length).toBeGreaterThan(5);
    expect(element.querySelectorAll('ul.guide-bullets > li').length).toBeGreaterThan(20);
  });

  it('lists pool job and pick when as a definition list', () => {
    const terms = Array.from(element.querySelectorAll('dl dt'), (term) => term.textContent?.trim());

    expect(terms).toEqual(['Pool job', 'Pick when']);
  });

  it('names the source under the video and says its link opens a new tab', () => {
    const caption = element.querySelector('.source .guide-caption');

    expect(caption?.textContent).toContain('Paz Captain America comprehensive guide');
    expect(caption?.querySelector('a')?.textContent).toContain('opens YouTube in a new tab');
  });

  it('has one main landmark wrapping the page', () => {
    expect(element.querySelectorAll('main').length).toBe(1);
    expect(element.querySelector('main h1')).not.toBeNull();
  });
});
