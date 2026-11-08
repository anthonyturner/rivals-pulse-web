import { ApplicationRef, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { HOME_HERO_VIDEO_STORAGE_KEY, HomeHeroVideoPreferenceService } from './home-hero-video-preference.service';

describe('HomeHeroVideoPreferenceService', () => {
  beforeEach(() => {
    localStorage.removeItem(HOME_HERO_VIDEO_STORAGE_KEY);
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  afterEach(() => localStorage.removeItem(HOME_HERO_VIDEO_STORAGE_KEY));

  async function firstRender(): Promise<void> {
    TestBed.inject(ApplicationRef).tick();
    await TestBed.inject(ApplicationRef).whenStable();
  }

  it('plays the video on a first visit', async () => {
    const preference = TestBed.inject(HomeHeroVideoPreferenceService);
    await firstRender();

    expect(preference.enabled()).toBeTrue();
  });

  it('restores a saved "off" after the first render', async () => {
    localStorage.setItem(HOME_HERO_VIDEO_STORAGE_KEY, 'off');
    const preference = TestBed.inject(HomeHeroVideoPreferenceService);

    expect(preference.enabled()).toBeTrue();

    await firstRender();

    expect(preference.enabled()).toBeFalse();
  });

  it('saves "off" and "on" as the choice changes', () => {
    const preference = TestBed.inject(HomeHeroVideoPreferenceService);

    preference.set(false);
    expect(preference.enabled()).toBeFalse();
    expect(localStorage.getItem(HOME_HERO_VIDEO_STORAGE_KEY)).toBe('off');

    preference.set(true);
    expect(preference.enabled()).toBeTrue();
    expect(localStorage.getItem(HOME_HERO_VIDEO_STORAGE_KEY)).toBe('on');
  });
});
