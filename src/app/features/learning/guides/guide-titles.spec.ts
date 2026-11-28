import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../app.routes';
import { PageMetaTitleStrategy } from '../../../core/seo/page-meta-title.strategy';
import { heroGuideTitle, strategistGuideTitle } from './guide-titles';

describe('guide title text', () => {
  it('adds "guide" to a hero name', () => {
    expect(heroGuideTitle({ heroName: 'Captain America', category: 'hero' })).toBe(
      'Captain America guide | RivalsPulse',
    );
  });

  it('does not add "guide" to a fundamentals guide, which names itself', () => {
    expect(heroGuideTitle({ heroName: 'The Ultimate Beginner Guide', category: 'fundamentals' })).toBe(
      'The Ultimate Beginner Guide | RivalsPulse',
    );
  });

  it('names a strategist guide by its title', () => {
    expect(strategistGuideTitle({ title: 'Ultimate Efficiency 101' })).toBe(
      'Ultimate Efficiency 101 | RivalsPulse',
    );
  });
});

describe('guide detail page titles', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    document.title = '';
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter(routes),
        { provide: TitleStrategy, useExisting: PageMetaTitleStrategy },
      ],
    });
    harness = await RouterTestingHarness.create();
  });

  describe('hero guide pages', () => {
    it('titles a hero guide with the hero name', async () => {
      await harness.navigateByUrl('/hero-guides/captain-america');

      expect(document.title).toBe('Captain America guide | RivalsPulse');
    });

    it('titles a fundamentals guide with its own name', async () => {
      await harness.navigateByUrl('/hero-guides/neutral-game-fundamentals');

      expect(document.title).toBe('Neutral Game Fundamentals | RivalsPulse');
    });

    it('follows the guide when another one is opened', async () => {
      await harness.navigateByUrl('/hero-guides/captain-america');
      await harness.navigateByUrl('/hero-guides/jubilee');

      expect(document.title).toBe('Jubilee guide | RivalsPulse');
    });

    it('shows the not-found title, not the previous guide, for a guide that does not exist', async () => {
      await harness.navigateByUrl('/hero-guides/captain-america');
      await harness.navigateByUrl('/hero-guides/no-such-hero');

      expect(document.title).toBe('Page not found | RivalsPulse');
    });
  });

  describe('strategist guide pages', () => {
    it('titles a strategist guide with its title', async () => {
      await harness.navigateByUrl('/strategist-guides/ult-efficiency-101');

      expect(document.title).toBe('Ultimate Efficiency 101 | RivalsPulse');
    });

    it('follows the guide when another one is opened', async () => {
      await harness.navigateByUrl('/strategist-guides/ult-efficiency-101');
      await harness.navigateByUrl('/strategist-guides/rocket-to-celestial');

      expect(document.title).toBe('Rocket to Celestial Guide | RivalsPulse');
    });

    it('shows the not-found title, not the previous guide, for a guide that does not exist', async () => {
      await harness.navigateByUrl('/strategist-guides/ult-efficiency-101');
      await harness.navigateByUrl('/strategist-guides/no-such-guide');

      expect(document.title).toBe('Page not found | RivalsPulse');
    });
  });
});
