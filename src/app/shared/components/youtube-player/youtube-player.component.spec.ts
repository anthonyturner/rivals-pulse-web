import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YoutubePlayerComponent } from './youtube-player.component';

describe('YoutubePlayerComponent', () => {
  let fixture: ComponentFixture<YoutubePlayerComponent>;
  let element: HTMLElement;

  const button = () => element.querySelector<HTMLButtonElement>('button');
  const image = () => element.querySelector<HTMLImageElement>('img');
  const iframe = () => element.querySelector<HTMLIFrameElement>('iframe');

  async function settle(): Promise<void> {
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    fixture = TestBed.createComponent(YoutubePlayerComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('videoId', 'abc_123-X');
    fixture.componentRef.setInput('title', 'A lesson');
    fixture.componentRef.setInput('label', 'Play video: A lesson');
    await settle();
  });

  it('shows a named play button over an empty-alt still, and loads no player before the press', () => {
    expect(iframe()).toBeNull();
    expect(button()?.getAttribute('aria-label')).toBe('Play video: A lesson');
    expect(button()?.getAttribute('type')).toBe('button');
    expect(image()?.getAttribute('alt')).toBe('');
    expect(image()?.getAttribute('src')).toBe('https://i.ytimg.com/vi/abc_123-X/hqdefault.jpg');
    expect(image()?.getAttribute('width')).toBe('480');
    expect(image()?.getAttribute('height')).toBe('360');
  });

  it('loads the still lazily unless told it is eager', async () => {
    expect(image()?.getAttribute('loading')).toBe('lazy');
    expect(image()?.hasAttribute('fetchpriority')).toBeFalse();

    fixture.componentRef.setInput('eager', true);
    await settle();

    expect(image()?.getAttribute('loading')).toBe('eager');
    expect(image()?.getAttribute('fetchpriority')).toBe('high');
  });

  it('swaps the button for a titled player on the privacy-enhanced host that autoplays, and focuses it', async () => {
    button()?.click();
    await settle();

    expect(button()).toBeNull();
    expect(iframe()?.src).toBe('https://www.youtube-nocookie.com/embed/abc_123-X?autoplay=1');
    expect(iframe()?.title).toBe('A lesson');
    expect(iframe()?.getAttribute('allow')).toContain('autoplay');
    expect(document.activeElement).toBe(iframe());
  });

  it('opens already playing when told it started, without taking focus', async () => {
    const before = document.activeElement;
    fixture.componentRef.setInput('started', true);
    await settle();

    expect(button()).toBeNull();
    expect(iframe()).not.toBeNull();
    expect(document.activeElement).toBe(before);
  });
});
