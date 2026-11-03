import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Hero } from '../hero.model';
import { HeroesPageComponent } from '../heroes-page.component';
import { HeroContentComponent } from './hero-content.component';

const mantis = {
  id: 'mantis',
  name: 'Mantis',
  role: 'Strategist',
  difficulty: 3,
  summary: 'Heals and buffs.',
  playstyle: '',
  strengths: [],
  weaknesses: [],
  counters: [],
  synergies: [],
  abilities: [],
  imageUrl: '/images/heroes/mantis.png',
} as Hero;

describe('HeroContentComponent', () => {
  let fixture: ComponentFixture<HeroContentComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const controller = TestBed.runInInjectionContext(() => new HeroesPageComponent());
    fixture = TestBed.createComponent(HeroContentComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('hero', mantis);
    fixture.componentRef.setInput('videos', [
      { label: 'Guide', query: 'q', url: 'https://example.test/a' },
      { label: 'Gameplay', query: 'q', url: 'https://example.test/b' },
    ]);
    fixture.componentRef.setInput('youtubeUrl', 'https://example.test/all');
    fixture.componentRef.setInput('controller', controller);
    fixture.detectChanges();
  });

  it('collapses the videos behind a summary that counts them', () => {
    const videos = element.querySelector('details.video-searches') as HTMLDetailsElement;

    expect(videos.open).toBeFalse();
    expect(videos.querySelector('summary')?.textContent?.trim()).toBe('YouTube videos (2)');
  });

  describe('focusing the hero name', () => {
    let heading: HTMLElement;
    let panel: HTMLElement;
    let scrollSpy: jasmine.Spy;

    /** Places the heading at a fixed spot in the window, since Karma's own layout does not decide what is on screen. */
    function placeHeading(top: number, bottom: number): void {
      spyOn(heading, 'getBoundingClientRect').and.returnValue({ top, bottom } as DOMRect);
    }

    beforeEach(() => {
      heading = element.querySelector('h2') as HTMLElement;
      panel = element.querySelector('.hero-detail') as HTMLElement;
      scrollSpy = spyOn(panel, 'scrollIntoView');
      document.documentElement.style.scrollPaddingTop = '56px';
    });

    afterEach(() => {
      document.documentElement.style.scrollPaddingTop = '';
    });

    it('focuses the name without scrolling the page when it is already on screen', () => {
      placeHeading(300, 340);
      const focusSpy = spyOn(heading, 'focus');

      fixture.componentInstance.focusHeading();

      expect(scrollSpy).not.toHaveBeenCalled();
      expect(focusSpy).toHaveBeenCalledOnceWith({ preventScroll: true });
    });

    it('scrolls the panel to the top when the name is above the page header', () => {
      placeHeading(40, 80);
      const focusSpy = spyOn(heading, 'focus');

      fixture.componentInstance.focusHeading();

      expect(scrollSpy).toHaveBeenCalledTimes(1);
      expect(focusSpy).toHaveBeenCalledOnceWith({ preventScroll: true });
    });

    it('scrolls the panel to the top when the name is past the bottom of the window', () => {
      placeHeading(window.innerHeight - 10, window.innerHeight + 30);

      fixture.componentInstance.focusHeading();

      expect(scrollSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('scrolls to the panel without animation when the reader prefers reduced motion and the name is off screen', () => {
    const panel = element.querySelector('.hero-detail') as HTMLElement;
    const scrollSpy = spyOn(panel, 'scrollIntoView');
    spyOn(element.querySelector('h2') as HTMLElement, 'getBoundingClientRect').and.returnValue({
      top: -500,
      bottom: -460,
    } as DOMRect);
    const matchMediaSpy = spyOn(window, 'matchMedia');

    matchMediaSpy.and.returnValue({ matches: true } as MediaQueryList);
    fixture.componentInstance.focusHeading();
    matchMediaSpy.and.returnValue({ matches: false } as MediaQueryList);
    fixture.componentInstance.focusHeading();

    expect(scrollSpy.calls.allArgs()).toEqual([
      [{ behavior: 'auto', block: 'start' }],
      [{ behavior: 'smooth', block: 'start' }],
    ]);
  });

  it('offers a link back to all heroes', () => {
    const back = element.querySelector('a.detail-action');

    expect(back?.getAttribute('href')).toBe('/heroes');
    expect(back?.textContent?.trim()).toContain('All heroes');
  });

  it('offers no way to open a profile window', () => {
    expect(element.querySelector('[data-testid="open-profile"]')).toBeNull();
    expect(element.textContent).not.toContain('Open profile');
  });
});
