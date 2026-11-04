import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';

import { HeroVideosComponent } from './hero-videos.component';

describe('HeroVideosComponent', () => {
  let fixture: ComponentFixture<HeroVideosComponent>;
  let element: HTMLElement;

  const videoAt = (url: string) => ({
    label: 'Guide',
    query: 'A guide',
    url,
    embedUrl: TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl('about:blank'),
  });

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(HeroVideosComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('heroName', 'Mantis');
    fixture.componentRef.setInput('youtubeUrl', 'https://example.test/all');
    fixture.componentRef.setInput('videos', [
      videoAt('https://example.test/a'),
      { label: 'Gameplay', query: 'Search', url: 'https://example.test/b' },
    ]);
    fixture.detectChanges();
  });

  it('names the videos after the hero and shows them without a click', () => {
    expect(element.querySelector('aside')?.getAttribute('aria-label')).toBe('YouTube videos for Mantis');
    expect(element.querySelector('details')).toBeNull();
    expect(element.querySelectorAll('.video-card').length).toBe(2);
  });

  it('shows a player only for a video that has one, and a link for every video', () => {
    expect(element.querySelectorAll('iframe').length).toBe(1);
    expect(element.querySelector('iframe')?.getAttribute('title')).toBe('Mantis Guide');
    expect(element.querySelectorAll('.video-copy a').length).toBe(2);
    expect(element.querySelector('.video-all')?.getAttribute('href')).toBe('https://example.test/all');
  });

  it('builds a new player for a different video, so changing hero adds no Back step', async () => {
    const before = element.querySelector('iframe');

    fixture.componentRef.setInput('videos', [videoAt('https://example.test/c')]);
    await fixture.whenStable();

    expect(element.querySelector('iframe')).not.toBeNull();
    expect(element.querySelector('iframe')).not.toBe(before);
  });
});
