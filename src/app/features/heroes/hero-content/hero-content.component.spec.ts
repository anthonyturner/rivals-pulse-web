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
    fixture.componentRef.setInput('isModalOpen', false);
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

  it('shows nothing while the profile window is open, so the page never holds two copies of the details', () => {
    fixture.componentRef.setInput('isModalOpen', true);
    fixture.detectChanges();

    expect(element.querySelector('.hero-detail')).toBeNull();
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

  it('emits when the reader asks to go back to the roster or open the profile', () => {
    const back = spyOn(fixture.componentInstance.rosterReturned, 'emit');
    const open = spyOn(fixture.componentInstance.profileOpened, 'emit');

    (element.querySelector('.detail-action:not(.detail-action--primary)') as HTMLButtonElement).click();
    (element.querySelector('[data-testid="open-profile"]') as HTMLButtonElement).click();

    expect(back).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledTimes(1);
  });
});
