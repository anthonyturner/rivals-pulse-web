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

  it('scrolls to the panel without animation when the reader prefers reduced motion', () => {
    const panel = element.querySelector('.hero-detail') as HTMLElement;
    const scrollSpy = spyOn(panel, 'scrollIntoView');
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
