import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';

import { HeroPosterBackdropComponent } from './hero-poster-backdrop.component';
import { HeroPosterBackdropPreferenceService } from './hero-poster-backdrop-preference.service';
import { YoutubeEmbedCommands } from './youtube-embed-commands';

describe('HeroPosterBackdropComponent', () => {
  const STORAGE_KEY = 'rp.hero-poster-backdrop';
  let fixture: ComponentFixture<HeroPosterBackdropComponent>;
  let element: HTMLElement;
  let youtube: jasmine.SpyObj<YoutubeEmbedCommands>;

  const toggle = (): HTMLButtonElement | null => element.querySelector('button[role="switch"]');
  const soundButton = (): HTMLButtonElement | null => element.querySelector('button[aria-pressed]');
  const loadVideo = async (): Promise<void> => {
    video()?.dispatchEvent(new Event('load'));
    await fixture.whenStable();
  };
  const video = (): HTMLIFrameElement | null => element.querySelector('iframe');
  const press = async (): Promise<void> => {
    toggle()?.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    youtube = jasmine.createSpyObj<YoutubeEmbedCommands>('YoutubeEmbedCommands', ['send']);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: YoutubeEmbedCommands, useValue: youtube }],
    });
    fixture = TestBed.createComponent(HeroPosterBackdropComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('heroName', 'Luna');
    fixture.componentRef.setInput('imageUrl', '/luna.png');
    fixture.componentRef.setInput(
      'videoUrl',
      TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl('about:blank'),
    );
    await fixture.whenStable();
  });

  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('shows the portrait and an off switch, with no player loaded', () => {
    expect(element.querySelector('img.poster-art__image')).not.toBeNull();
    expect(toggle()?.getAttribute('role')).toBe('switch');
    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
    expect(video()).toBeNull();
  });

  it('plays the video when switched on and returns to the portrait when switched off', async () => {
    await press();

    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
    expect(video()?.closest('.poster-art')?.hasAttribute('inert')).toBeTrue();

    await press();

    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
    expect(video()).toBeNull();
  });

  it('offers sound once the playing video has loaded, starting muted', async () => {
    expect(soundButton()).toBeNull();

    await press();
    await loadVideo();

    expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('unmutes and mutes the playing video without reloading it', async () => {
    await press();
    await loadVideo();
    const frame = video();

    soundButton()?.click();
    await fixture.whenStable();

    expect(soundButton()?.getAttribute('aria-pressed')).toBe('true');
    expect(youtube.send).toHaveBeenCalledWith(frame!, 'unMute');

    soundButton()?.click();
    await fixture.whenStable();

    expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
    expect(youtube.send).toHaveBeenCalledWith(frame!, 'mute');
    expect(video()).toBe(frame);
  });

  it('starts muted again when the video is switched off and back on', async () => {
    await press();
    await loadVideo();
    soundButton()?.click();
    await fixture.whenStable();

    await press();
    await press();
    await loadVideo();

    expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('starts muted again when the hero changes', async () => {
    await press();
    await loadVideo();
    soundButton()?.click();
    await fixture.whenStable();

    fixture.componentRef.setInput(
      'videoUrl',
      TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl('about:blank#next'),
    );
    await fixture.whenStable();
    await loadVideo();

    expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
  });

  it('remembers the choice in this browser', async () => {
    await press();

    expect(localStorage.getItem(STORAGE_KEY)).toBe('video');
  });

  it('still switches, for this visit only, when the browser refuses storage', async () => {
    spyOn(Storage.prototype, 'setItem').and.throwError('blocked');

    await press();

    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
  });

  it('hides the switch and the player when the hero has no video', async () => {
    TestBed.inject(HeroPosterBackdropPreferenceService).set('video');
    fixture.componentRef.setInput('videoUrl', null);
    await fixture.whenStable();

    expect(toggle()).toBeNull();
    expect(video()).toBeNull();
  });
});

describe('HeroPosterBackdropPreferenceService', () => {
  it('starts on the portrait and restores a saved video choice after the first render', async () => {
    localStorage.setItem('rp.hero-poster-backdrop', 'video');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const preference = TestBed.inject(HeroPosterBackdropPreferenceService);

    expect(preference.backdrop()).toBe('portrait');

    const fixture = TestBed.createComponent(HeroPosterBackdropComponent);
    fixture.componentRef.setInput('heroName', 'Luna');
    fixture.componentRef.setInput('imageUrl', '/luna.png');
    await fixture.whenStable();

    expect(preference.backdrop()).toBe('video');
    localStorage.removeItem('rp.hero-poster-backdrop');
  });

  it('falls back to the portrait when the browser refuses to read storage', async () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('blocked');
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const preference = TestBed.inject(HeroPosterBackdropPreferenceService);
    const fixture = TestBed.createComponent(HeroPosterBackdropComponent);
    fixture.componentRef.setInput('heroName', 'Luna');
    fixture.componentRef.setInput('imageUrl', '/luna.png');
    await fixture.whenStable();

    expect(preference.backdrop()).toBe('portrait');
  });
});

describe('YoutubeEmbedCommands', () => {
  it('posts the command to the YouTube player as a JSON message for its origin only', () => {
    const postMessage = jasmine.createSpy('postMessage');
    const frame = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;

    new YoutubeEmbedCommands().send(frame, 'unMute');

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
      'https://www.youtube-nocookie.com',
    );
  });
});
