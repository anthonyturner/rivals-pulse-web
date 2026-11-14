import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { findHeroGuide } from './hero-guide-data';
import { HeroGuideDetailPageComponent } from './hero-guide-detail-page.component';
import type { HeroGuide } from './hero-guide.types';

const SHORT_LESSONS = [
  {
    id: 'presence-pressure',
    title: 'Presence Pressure',
    sourceLabel: 'Most Overlooked Skill short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=9RJ9VfZv8EY&list=PL5TQ7tktRWOC3sAGM2Fg-TdOQTDSxMHd6',
  },
  {
    id: 'duelist-pressure-over-damage',
    title: 'Duelist Pressure Over Damage',
    sourceLabel: 'Stop Chasing Damage duelist guide',
    sourceUrl: 'https://www.youtube.com/watch?v=kPnMQTQuEpc&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
  },
  {
    id: 'duelist-disengage-discipline',
    title: 'Duelist Disengage Discipline',
    sourceLabel: 'Stop Forcing Fights duelist guide',
    sourceUrl: 'https://www.youtube.com/watch?v=GY37xZLPkC8&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
  },
  {
    id: 'duelist-target-priority',
    title: 'Duelist Target Priority',
    sourceLabel: 'Target Priority Explained duelist guide',
    sourceUrl: 'https://www.youtube.com/watch?v=zuvJYHK2rB0&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
  },
  {
    id: 'duelist-off-angle-short',
    title: 'Duelist Off-Angles',
    sourceLabel: 'Duelist Off Angles short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=LAWuwOuRM5E&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
  },
  {
    id: 'dps-pressure-short',
    title: 'DPS Pressure Over Damage',
    sourceLabel: 'DPS Pressure Over Damage short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=qJhxR9jZaBY&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
  },
  {
    id: 'duelist-disengage-short',
    title: 'Duelist Reset Rules',
    sourceLabel: 'Duelist Disengaging short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=W6uvOtZJK-I&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
  },
  {
    id: 'target-priority-short',
    title: 'Target Priority Quick Guide',
    sourceLabel: 'Duelist Target Priority short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=Ki4D-8EAUps&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
  },
] as const;

function lesson(id: string): HeroGuide {
  const guide = findHeroGuide(id);
  if (!guide) throw new Error(`Missing short lesson: ${id}`);
  return guide;
}

function chapterText(id: string): string {
  return lesson(id).sections.flatMap(section => section.paragraphs).join(' ');
}

describe('Short fundamentals editorial content', () => {
  it('keeps all eight distinct lesson identities and original source credits, including playlists', () => {
    for (const expected of SHORT_LESSONS) {
      const guide = lesson(expected.id);
      expect(guide.heroName).withContext(expected.id).toBe(expected.title);
      expect(guide.sourceLabel).withContext(expected.id).toBe(expected.sourceLabel);
      expect(guide.sourceUrl).withContext(expected.id).toBe(expected.sourceUrl);
    }
  });

  it('labels new applications as hypothetical rather than inventing video moments', () => {
    for (const { id } of SHORT_LESSONS) {
      const guide = lesson(id);
      expect(guide.workedExample?.title).withContext(id).toMatch(/^Hypothetical:/);
      expect(guide.workedExample?.sourceUrl).withContext(id).toBeUndefined();
      expect(guide.workedExample?.paragraphs.join(' ')).withContext(id).not.toMatch(/\b\d+:\d{2}\b/);
      expect(guide.practiceFocus).withContext(id).toMatch(/review|replay/i);
    }
  });

  it('retains main-lane alternatives, contested-angle resets and recovery planning in the pressure lesson', () => {
    const text = chapterText('duelist-pressure-over-damage');
    expect(text).toContain('not a requirement to flank every fight');
    expect(text).toContain('Reset a contested attempt');
    expect(text).toContain('nearby health pack');
    expect(text).toContain('large total does not establish');
  });

  it('keeps cover and awareness ahead of emergency mobility in the disengage lesson', () => {
    const text = chapterText('duelist-disengage-discipline');
    expect(text).toContain('a movement ability is an emergency option');
    expect(text).toContain('Breaking sightlines with natural cover');
    expect(text).toContain('several small resets');
    expect(text).toContain('a new ability or ultimate');
  });

  it('keeps target access, temporary targets and peeling as conditional priority decisions', () => {
    const text = chapterText('duelist-target-priority');
    expect(text).toContain('does not create safe access');
    expect(text).toContain('someone you can actually reach');
    expect(text).toContain('Peeling means helping a teammate');
    expect(text).toContain('reset if the peel itself becomes an unfavorable trade');
    expect(text).toContain('no fixed order');
  });
});

describe('Short fundamentals reading routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([{ path: 'hero-guides/:heroId', component: HeroGuideDetailPageComponent }]),
      ],
    });
  });

  it('opens each existing address as a sourced article with example, practice and chapter targets', async () => {
    const harness = await RouterTestingHarness.create();
    for (const expected of SHORT_LESSONS) {
      await harness.navigateByUrl(`/hero-guides/${expected.id}`, HeroGuideDetailPageComponent);
      const page = harness.routeNativeElement;
      if (!page) throw new Error(`No page rendered for ${expected.id}`);
      expect(page.querySelector('h1')?.textContent?.trim()).withContext(expected.id).toBe(expected.title);
      expect(page.querySelector('.field-guide__source-credit')?.textContent).withContext(expected.id).toContain(expected.sourceLabel);
      const sourceLinks = Array.from(page.querySelectorAll<HTMLAnchorElement>('#sources a'));
      expect(sourceLinks.some(link => link.getAttribute('href') === expected.sourceUrl)).withContext(expected.id).toBeTrue();
      expect(page.querySelector('#worked-example')?.textContent).withContext(expected.id).toContain('Hypothetical:');
      expect(page.querySelector('#next-match')?.textContent).withContext(expected.id).toMatch(/review|replay/i);
      expect(page.querySelector('.guide-tile, .guide-bullets')).withContext(expected.id).toBeNull();
      for (const anchor of Array.from(page.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'))) {
        const target = new URL(anchor.href).hash.slice(1);
        expect(page.querySelector(`[id="${target}"]`)).withContext(`${expected.id}: ${target}`).not.toBeNull();
      }
    }
  });
});
