import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroVideoSearch } from '../hero.model';
import { HeroVideosComponent } from './hero-videos.component';

describe('HeroVideosComponent', () => {
  let fixture: ComponentFixture<HeroVideosComponent>;
  let element: HTMLElement;

  const videoAt = (url: string): HeroVideoSearch => ({
    label: 'Guide',
    query: 'A guide',
    url,
    youtubeId: url.slice(-1),
  });
  const playButton = (): HTMLButtonElement | null => element.querySelector('button');
  const press = async (button: HTMLButtonElement | null): Promise<void> => {
    button?.click();
    await fixture.whenStable();
  };
  const setVideos = async (videos: HeroVideoSearch[]): Promise<void> => {
    fixture.componentRef.setInput('videos', videos);
    await fixture.whenStable();
  };

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(HeroVideosComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('heroName', 'Mantis');
    fixture.componentRef.setInput('youtubeUrl', 'https://example.test/all');
    fixture.componentRef.setInput('videos', [
      videoAt('https://example.test/a'),
      { label: 'Gameplay', query: 'Search', url: 'https://example.test/b' },
    ]);
    await fixture.whenStable();
  });

  it('names the videos after the hero and shows them without a click', () => {
    expect(element.querySelector('aside')?.getAttribute('aria-label')).toBe('YouTube videos for Mantis');
    expect(element.querySelector('details')).toBeNull();
    expect(element.querySelectorAll('.video-card').length).toBe(2);
  });

  it('shows a play button, not a player, for a video that has one, and a link for every video', () => {
    expect(element.querySelectorAll('button').length).toBe(1);
    expect(element.querySelectorAll('.video-copy a').length).toBe(2);
    expect(element.querySelector('.video-all')?.getAttribute('href')).toBe('https://example.test/all');
  });

  it('loads no player before the press', () => {
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('names the button after the hero and the video, and gives the picture no name of its own', () => {
    const button = playButton();
    const image = button?.querySelector('img');

    expect(button?.getAttribute('aria-label')).toBe('Play Mantis Guide video');
    expect(button?.getAttribute('type')).toBe('button');
    expect(image?.getAttribute('alt')).toBe('');
  });

  it('shows the video thumbnail, loaded lazily', () => {
    const image = playButton()?.querySelector('img');

    expect(image?.getAttribute('src')).toBe('https://i.ytimg.com/vi/a/hqdefault.jpg');
    expect(image?.getAttribute('loading')).toBe('lazy');
  });

  it('replaces the button with the player when pressed, and focuses the player', async () => {
    await press(playButton());

    const player = element.querySelector('iframe');
    expect(playButton()).toBeNull();
    expect(player?.getAttribute('title')).toBe('Mantis Guide');
    expect(player?.getAttribute('allow')).toContain('autoplay');
    expect(document.activeElement).toBe(player);
  });

  it('starts only the video that was pressed', async () => {
    await setVideos([videoAt('https://example.test/a'), videoAt('https://example.test/b')]);

    await press(element.querySelectorAll<HTMLButtonElement>('button')[1]);

    expect(element.querySelectorAll('iframe').length).toBe(1);
    expect(element.querySelectorAll('button').length).toBe(1);
  });

  it('keeps a started player when the same video is given again in a new list', async () => {
    await press(playButton());
    const before = element.querySelector('iframe');

    await setVideos([{ ...videoAt('https://example.test/a') }]);

    expect(element.querySelector('iframe')).toBe(before);
    expect(playButton()).toBeNull();
  });

  it('builds a new card for a different video', async () => {
    await press(playButton());

    await setVideos([videoAt('https://example.test/c')]);

    expect(element.querySelector('iframe')).toBeNull();
    expect(playButton()).not.toBeNull();
  });

  it('asks again for a video that left the list and came back', async () => {
    await press(playButton());
    await setVideos([videoAt('https://example.test/c')]);

    await setVideos([videoAt('https://example.test/a')]);

    expect(element.querySelector('iframe')).toBeNull();
    expect(playButton()).not.toBeNull();
  });
});
