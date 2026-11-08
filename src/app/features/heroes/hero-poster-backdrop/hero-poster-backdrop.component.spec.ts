import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';

import { HeroPosterBackdropComponent } from './hero-poster-backdrop.component';
import { HeroPosterBackdropPreferenceService } from './hero-poster-backdrop-preference.service';

describe('HeroPosterBackdropComponent', () => {
  const STORAGE_KEY = 'rp.hero-poster-backdrop';
  let fixture: ComponentFixture<HeroPosterBackdropComponent>;
  let element: HTMLElement;

  const toggle = (): HTMLButtonElement | null => element.querySelector('button.backdrop-switch');
  const video = (): HTMLIFrameElement | null => element.querySelector('iframe');
  const press = async (): Promise<void> => {
    toggle()?.click();
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
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
    expect(video()?.getAttribute('tabindex')).toBe('-1');

    await press();

    expect(toggle()?.getAttribute('aria-checked')).toBe('false');
    expect(video()).toBeNull();
  });

  it('remembers the choice in this browser', async () => {
    await press();

    expect(localStorage.getItem(STORAGE_KEY)).toBe('video');
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
});
