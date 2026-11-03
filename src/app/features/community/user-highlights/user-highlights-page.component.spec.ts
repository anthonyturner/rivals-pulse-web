import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserHighlightsPageComponent } from './user-highlights-page.component';

describe('UserHighlightsPageComponent', () => {
  let fixture: ComponentFixture<UserHighlightsPageComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(UserHighlightsPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('leaves the main landmark to the shell and has one h1', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('h1')?.textContent).toContain('User highlights');
  });

  it('plays the clip only when asked', () => {
    const video = element.querySelector('video') as HTMLVideoElement;

    expect(video.controls).toBeTrue();
    expect(video.autoplay).toBeFalse();
    expect(video.loop).toBeFalse();
    expect(video.getAttribute('preload')).toBe('metadata');
  });

  it('says the original link opens a new tab', () => {
    const link = element.querySelector('a[target="_blank"]') as HTMLAnchorElement;

    expect(link.getAttribute('rel')).toContain('noopener');
    expect(link.querySelector('.visually-hidden')?.textContent).toContain('opens in a new tab');
  });

  it('keeps the heading order h2 then h3 and shows the player as a hero tile', () => {
    const levels = Array.from(element.querySelectorAll('h2, h3'), (heading) => heading.tagName);

    expect(levels).toEqual(['H2', 'H2', 'H2', 'H3', 'H3', 'H2']);
    expect(element.querySelector('app-hero-tile')?.textContent).toContain('Played by SilentCoder');
  });
});
