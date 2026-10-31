import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { HomeContent } from '../home-content.model';
import { emptyHomeContent, fullHomeContent } from '../home-content.fixtures';
import { GameNewsRailComponent } from './game-news-rail.component';

const season = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const stats = {
  status: 'ready',
  minimumMatches: 10,
  halfSeasons: [season],
  halfSeason: season,
  inPlaceOf: null,
  matchesCounted: 149,
  tiers: [],
  belowMinimum: [],
};

describe('GameNewsRailComponent', () => {
  let fixture: ComponentFixture<GameNewsRailComponent>;
  let http: HttpTestingController;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  async function render(content: HomeContent, answer: object | 'fail' = stats): Promise<void> {
    fixture = TestBed.createComponent(GameNewsRailComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('content', content);
    fixture.detectChanges();

    if (answer === 'fail') {
      http.expectOne('/api/hero-stats').flush('down', { status: 500, statusText: 'Server Error' });
    } else {
      http.expectOne('/api/hero-stats').flush(answer);
    }

    await fixture.whenStable();
    fixture.detectChanges();
  }

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  describe('with all the news', () => {
    beforeEach(async () => render(fullHomeContent));

    it('is one aside labelled "Game News" with an h2, holding every block', () => {
      const aside = element.querySelector('aside');
      const heading = element.querySelector('h2');

      expect(element.querySelectorAll('aside').length).toBe(1);
      expect(text(heading)).toBe('Game News');
      expect(aside?.getAttribute('aria-labelledby')).toBe(heading?.id);
      expect(aside?.querySelectorAll('h3').length).toBe(5);
      expect(element.querySelectorAll('h1, h2').length).toBe(1);
    });

    it('lists the blocks in order: season, newest hero, updates, spotlight, events', () => {
      expect(Array.from(element.querySelectorAll('h3')).map(text)).toEqual([
        'Season status',
        'Newest hero',
        'Latest news and patch notes',
        'Step into Season 10 // Dev Vision Vol. 21',
        'Events and rewards',
      ]);
    });

    it('dates the season from the latest half-season once the hero stats arrive', () => {
      expect(text(element.querySelector('.block'))).toContain('October 9, 2026 – ongoing');
    });

    it('links the updates and the tuning post to the official site in a new tab', () => {
      const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('a'));

      expect(links.length).toBeGreaterThan(0);
      expect(links.every((link) => link.target === '_blank' && link.rel.includes('noopener'))).toBeTrue();
      expect(element.querySelectorAll('.list__link').length).toBe(3);
    });

    it('asks the page to open the video when "Watch update video" is pressed', () => {
      let asked = 0;

      fixture.componentInstance.watchVideo.subscribe(() => asked++);
      (element.querySelector('.actions__watch') as HTMLButtonElement).click();

      expect(asked).toBe(1);
      expect(text(element.querySelector('.actions__watch'))).toBe('Watch update video');
    });

    it('links the full season update beside the button', () => {
      const link = element.querySelector('.actions a');

      expect(text(link)).toContain('Read season update');
      expect(link?.getAttribute('href')).toBe('https://example.com/season');
    });
  });

  it('has no watch button, but still the link, when the season update has no video', async () => {
    const [update] = fullHomeContent.latestNews;

    await render({ ...fullHomeContent, latestNews: [{ ...update, videoUrl: undefined }] });

    expect(element.querySelector('.actions__watch')).toBeNull();
    expect(text(element.querySelector('.actions a'))).toContain('Read season update');
  });

  it('collapses the blocks it has nothing for and says there is no news when all are empty', async () => {
    await render(emptyHomeContent);

    expect(element.querySelector('aside')).toBeTruthy();
    expect(element.querySelectorAll('h3').length).toBe(0);
    expect(text(element.querySelector('.rail__title'))).toBe('Game News');
    expect(text(element.querySelector('aside > p'))).toBe('No news yet.');
  });

  it('keeps the season block without a date when the hero stats cannot be read', async () => {
    await render(fullHomeContent, 'fail');

    expect(text(element.querySelector('.block'))).toContain('Live now');
    expect(text(element.querySelector('.block'))).not.toContain('ongoing');
    expect(element.textContent).not.toMatch(/undefined|NaN/);
  });
});
