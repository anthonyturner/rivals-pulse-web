import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

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

  it('shows each section as a card with plain bullets', () => {
    expect(element.querySelectorAll('.guide-tile h2').length).toBeGreaterThan(5);
    expect(element.querySelectorAll('ul.guide-bullets > li').length).toBeGreaterThan(20);
  });

  it('makes only the first bullet of a section semibold, not the first matchup chip', () => {
    const weight = (selector: string) => getComputedStyle(element.querySelector(selector) as HTMLElement).fontWeight;

    expect(weight('.guide-bullets > li:first-child')).toBe('700');
    expect(weight('.guide-bullets > li:nth-child(2)')).toBe('400');
    expect(weight('.chips > li:first-child')).toBe('400');
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

  describe('a guide built from written articles', () => {
    const pageText = () => element.textContent?.replace(/\s+/g, ' ') ?? '';
    const sourceLinks = () =>
      Array.from(element.querySelectorAll<HTMLAnchorElement>('.article-sources a'));

    beforeEach(() => open('tempo-and-ultimate-economy'));

    it('credits each source with a visible link that opens in a new tab', () => {
      expect(sourceLinks().map((link) => link.hostname)).toEqual([
        'www.xtremeps3.com',
        'metabot.gg',
        'boostroom.com',
      ]);
      for (const link of sourceLinks()) {
        expect(link.target).toBe('_blank');
        expect(link.rel).toContain('noopener');
        expect(link.textContent).toContain('opens in a new tab');
      }
    });

    it('lists Boostroom as further reading and credits no advice to it', () => {
      const boostroom = sourceLinks()[2].closest('li');

      expect(boostroom?.textContent).toContain('Further reading only');
      expect(boostroom?.textContent).toContain('nothing in this guide is based on it');
      for (const section of Array.from(element.querySelectorAll('section.guide-tile'))) {
        expect(section.textContent).not.toContain('Boostroom');
      }
    });

    it('does not offer a video or claim its source is on YouTube', () => {
      expect(element.querySelector('iframe')).toBeNull();
      expect(pageText()).not.toContain('YouTube');
    });

    it('says the tempo article is about Overwatch', () => {
      expect(sourceLinks()[0].closest('li')?.textContent).toContain('about Overwatch, not Marvel Rivals');
    });

    it('describes the overlay chip as untested, with no store link', () => {
      expect(pageText()).toContain('coming soon to the Overwolf store');
      expect(pageText()).toContain('Nobody has checked it in a real match');
      expect(element.querySelector('a[href*="overwolf"]')).toBeNull();
    });
  });

  it('shows no article sources on a guide that has a video source', () => {
    expect(element.querySelector('.article-sources')).toBeNull();
  });

  it('opens the Nightcrawler launch guide with article attribution and no invented video', async () => {
    await open('nightcrawler');

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Nightcrawler');
    const sources = Array.from(element.querySelectorAll<HTMLAnchorElement>('.article-sources a'));
    expect(sources.map((link) => link.hostname)).toEqual(['marvelrivals.gg', 'www.marvelrivals.com']);
    expect(element.textContent).toContain('Early Season 11');
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('leaves the main landmark to the shell and has an h1', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('h1')).not.toBeNull();
  });
});
