import { ApplicationRef, provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';

import { ReducedMotionService } from '../../../core/accessibility/reduced-motion.service';
import { AuthService } from '../../../core/auth/auth.service';
import type { MediaDefaults } from '../../../core/auth/media-defaults.types';
import { HeroPosterBackdropComponent } from './hero-poster-backdrop.component';
import { HeroPosterBackdropPreferenceService } from './hero-poster-backdrop-preference.service';
import { YOUTUBE_EMBED_ORIGIN, YoutubeEmbedCommands } from './youtube-embed-commands';

describe('HeroPosterBackdropComponent for a signed-in visitor', () => {
  const STORAGE_KEY = 'rp.hero-poster-backdrop';
  const ACCOUNT = { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' };
  let fixture: ComponentFixture<HeroPosterBackdropComponent>;
  let element: HTMLElement;
  let youtube: jasmine.SpyObj<YoutubeEmbedCommands>;
  let reduced: ReturnType<typeof signal<boolean>>;

  const toggle = (): HTMLButtonElement | null => element.querySelector('button[role="switch"]');
  const soundButton = (): HTMLButtonElement | null => element.querySelector('button[aria-pressed]');
  const video = (): HTMLIFrameElement | null => element.querySelector('iframe');
  const settle = (): Promise<void> => fixture.whenStable();

  const create = async (defaults: MediaDefaults | null, options: { canStartWithSound?: boolean } = {}): Promise<void> => {
    youtube = jasmine.createSpyObj<YoutubeEmbedCommands>('YoutubeEmbedCommands', ['send', 'listen', 'canStartWithSound']);
    youtube.canStartWithSound.and.returnValue(options.canStartWithSound ?? true);
    reduced = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: YoutubeEmbedCommands, useValue: youtube },
        { provide: ReducedMotionService, useValue: { reduced: reduced.asReadonly() } },
      ],
    });
    TestBed.inject(AuthService).state.set({
      status: 'signedIn',
      account: ACCOUNT,
      player: null,
      isAdmin: false,
      mediaDefaults: defaults,
    });
    fixture = TestBed.createComponent(HeroPosterBackdropComponent);
    element = fixture.nativeElement;
    fixture.componentRef.setInput('heroName', 'Luna');
    fixture.componentRef.setInput('imageUrl', '/luna.png');
    fixture.componentRef.setInput('videoUrl', TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl('about:blank'));
    await settle();
  };

  const playerSays = async (
    data: unknown,
    origin: string = YOUTUBE_EMBED_ORIGIN,
    source: MessageEventSource | null = video()?.contentWindow ?? null,
  ): Promise<void> => {
    window.dispatchEvent(new MessageEvent('message', { data, origin, source }));
    await settle();
  };
  const ready = (): Promise<void> => playerSays(JSON.stringify({ event: 'onReady', info: null, channel: 'widget', id: 1 }));
  const loaded = async (): Promise<void> => {
    video()?.dispatchEvent(new Event('load'));
    await settle();
  };

  beforeEach(() => localStorage.removeItem(STORAGE_KEY));
  afterEach(() => localStorage.removeItem(STORAGE_KEY));

  it('opens on the gameplay video when the account default is on', async () => {
    await create({ heroVideo: true, sound: false });

    expect(video()).not.toBeNull();
    expect(toggle()?.getAttribute('aria-checked')).toBe('true');
  });

  it('opens on the portrait when the account default is off, even if this browser remembered the video', async () => {
    localStorage.setItem(STORAGE_KEY, 'video');
    await create({ heroVideo: false, sound: false });
    TestBed.inject(ApplicationRef).tick();
    await settle();

    expect(video()).toBeNull();
    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
  });

  it('never starts the video by itself when the device asks for less motion, whatever the account default says', async () => {
    await create({ heroVideo: true, sound: false });
    reduced.set(true);
    await settle();

    expect(video()).toBeNull();
    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
  });

  it('still plays the video when a visitor who asked for less motion switches it on themselves', async () => {
    await create({ heroVideo: true, sound: false });
    reduced.set(true);
    await settle();

    toggle()?.click();
    await settle();

    expect(video()).not.toBeNull();
  });

  it('switches for this visit only: nothing is saved in the browser or the account, and the default returns next visit', async () => {
    await create({ heroVideo: true, sound: false });

    toggle()?.click();
    await settle();

    expect(video()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(TestBed.inject(AuthService).mediaDefaults()).toEqual({ heroVideo: true, sound: false });
  });

  it('falls back to this browser\'s remembered choice when the account defaults could not be read', async () => {
    localStorage.setItem(STORAGE_KEY, 'video');
    await create(null);
    TestBed.inject(ApplicationRef).tick();
    await settle();

    expect(video()).not.toBeNull();
  });

  describe('sound', () => {
    it('listens to the player once it has loaded, so it can tell when the player takes commands', async () => {
      await create({ heroVideo: true, sound: true });
      await loaded();

      expect(youtube.listen).toHaveBeenCalledWith(video()!);
    });

    it('unmutes when the account default is on, the player is ready and the browser allows sound', async () => {
      await create({ heroVideo: true, sound: true });
      await loaded();

      expect(youtube.send).not.toHaveBeenCalled();
      expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');

      await ready();

      expect(youtube.send).toHaveBeenCalledOnceWith(video()!, 'unMute');
      expect(soundButton()?.getAttribute('aria-pressed')).toBe('true');
    });

    it('stays muted, and shows sound off with no error, when the browser would block the sound', async () => {
      await create({ heroVideo: true, sound: true }, { canStartWithSound: false });
      await loaded();
      await ready();

      expect(youtube.send).not.toHaveBeenCalled();
      expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
    });

    it('stays muted when the account default is off', async () => {
      await create({ heroVideo: true, sound: false });
      await loaded();
      await ready();

      expect(youtube.send).not.toHaveBeenCalled();
      expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
    });

    it('lets the visitor mute it for this video, and does not unmute it again', async () => {
      await create({ heroVideo: true, sound: true });
      await loaded();
      await ready();

      soundButton()?.click();
      await settle();

      expect(youtube.send).toHaveBeenCalledWith(video()!, 'mute');
      expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');

      await ready();

      expect(soundButton()?.getAttribute('aria-pressed')).toBe('false');
    });

    it('ignores messages that are not from this video\'s player saying it is ready', async () => {
      await create({ heroVideo: true, sound: true });
      await loaded();

      await playerSays(JSON.stringify({ event: 'onReady' }), 'https://evil.example');
      await playerSays(JSON.stringify({ event: 'onReady' }), YOUTUBE_EMBED_ORIGIN, window);
      await playerSays(JSON.stringify({ event: 'infoDelivery', info: {} }));
      await playerSays('not json');
      await playerSays({ event: 'onReady' });

      expect(youtube.send).not.toHaveBeenCalled();
    });

    it('applies the default again to the next hero\'s video', async () => {
      await create({ heroVideo: true, sound: true });
      await loaded();
      await ready();
      soundButton()?.click();
      await settle();
      youtube.send.calls.reset();

      fixture.componentRef.setInput(
        'videoUrl',
        TestBed.inject(DomSanitizer).bypassSecurityTrustResourceUrl('about:blank#next'),
      );
      await settle();
      await loaded();
      await ready();

      expect(youtube.send).toHaveBeenCalledOnceWith(video()!, 'unMute');
      expect(soundButton()?.getAttribute('aria-pressed')).toBe('true');
    });
  });
});

describe('HeroPosterBackdropPreferenceService for a signed-in visitor', () => {
  it('goes back to the account default on the next visit after a switch', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    TestBed.inject(AuthService).state.set({
      status: 'signedIn',
      account: { email: null, provider: 'discord', createdAt: '2026-11-01T00:00:00Z' },
      player: null,
      isAdmin: false,
      mediaDefaults: { heroVideo: true, sound: false },
    });
    const preference = TestBed.inject(HeroPosterBackdropPreferenceService);

    expect(preference.backdrop()).toBe('video');

    preference.set('portrait');

    expect(preference.backdrop()).toBe('portrait');
    expect(localStorage.getItem('rp.hero-poster-backdrop')).toBeNull();
  });
});

describe('YoutubeEmbedCommands browser rules', () => {
  const userActivation = (value: Partial<UserActivation> | undefined): void => {
    spyOnProperty(navigator, 'userActivation', 'get').and.returnValue(value as UserActivation);
  };

  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));

  it('asks the player to report back, for its origin only', () => {
    const postMessage = jasmine.createSpy('postMessage');
    const frame = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;

    TestBed.inject(YoutubeEmbedCommands).listen(frame);

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
      YOUTUBE_EMBED_ORIGIN,
    );
  });

  it('allows sound once the visitor has pressed or typed something on the page', () => {
    userActivation({ hasBeenActive: true, isActive: false });

    expect(TestBed.inject(YoutubeEmbedCommands).canStartWithSound()).toBeTrue();
  });

  it('says no before the visitor has interacted', () => {
    userActivation({ hasBeenActive: false, isActive: false });

    expect(TestBed.inject(YoutubeEmbedCommands).canStartWithSound()).toBeFalse();
  });

  it('says no when the browser cannot say, so a video is never left muted while the page claims sound', () => {
    userActivation(undefined);

    expect(TestBed.inject(YoutubeEmbedCommands).canStartWithSound()).toBeFalse();
  });
});
