import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { CommunityHeroScores } from '../../../../contracts/hero-scores.model';
import { HeroBuildSignalsComponent } from './hero-build-signals.component';

const launch: CommunityHeroScores = {
  status: 'not-enough-data',
  minimums: { matches: 10, contributors: 3, busiestContributorShare: 0.5, rankedHeroes: 5 },
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  heroes: [],
};

const scored: CommunityHeroScores = {
  ...launch,
  status: 'ready',
  heroes: [
    {
      hero: 'hela',
      damage: { status: 'scored', score: 9, label: 'measured', matches: 42, contributors: null, oneContributorAboveHalf: null, measures: { damagePerMinute: 1180 } },
      sustain: { status: 'collecting', score: null, label: 'measured', matches: 5, contributors: 2, oneContributorAboveHalf: false, measures: null },
      ultimate: { status: 'scored', score: 8, label: 'estimated', matches: 42, contributors: null, oneContributorAboveHalf: null, measures: { usesPerTenMinutes: 1.6, takedownsPerUse: 2.1 } },
      utility: { status: 'no-measurable-ability', score: null, label: 'estimated', matches: 0, contributors: null, oneContributorAboveHalf: null, measures: null },
      abilities: [{ slot: 'ultimate', ability: 'Goddess of Death', tag: null, usesPerTenMinutes: 1.6, takedownsPerUse: 2.1, matches: 42 }],
    },
  ],
};

describe('HeroBuildSignalsComponent', () => {
  function render(scores: CommunityHeroScores | null | undefined): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HeroBuildSignalsComponent);
    fixture.componentRef.setInput('heroId', 'hela');
    fixture.componentRef.setInput('scores', scores);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  const text = (element: HTMLElement): string => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('shows scores, figures and ability use, and marks estimates apart from measurements', () => {
    const element = render(scored);

    expect(element.querySelectorAll('[role="meter"]').length).toBe(3);
    expect(element.querySelector('.estimated .source')?.textContent).toBe('Estimated');
    expect(element.querySelector('.measured .source')?.textContent).toBe('Measured');
    expect(element.querySelector('.hero-kit .source')?.textContent).toBe('Hero kit');
    expect(text(element)).toContain('1,180 damage per minute');
    expect(text(element)).toContain('5 of 10 matches, 2 of 3 players');
    expect(text(element)).toContain('This is not a low score.');
    expect([...element.querySelectorAll('tbody th, tbody td')].map((cell) => text(cell as HTMLElement))).toEqual([
      'Goddess of Death Q',
      'Ultimate',
      '1.6',
      '2.10',
      '42',
    ]);
  });

  it('shows the launch state with Mobility still there and no invented number', () => {
    const element = render(launch);

    expect(element.querySelectorAll('[role="meter"]').length).toBe(1);
    expect(text(element)).toContain('0 of 10 matches, 0 of 3 players');
    expect(text(element)).toContain('Collecting data: no ability has enough matches yet.');
    expect(element.querySelector('table')).toBeNull();
  });

  it('shows five score tracks with a visible scale and separates collection from scores', () => {
    const element = render(scored);
    expect(element.querySelectorAll('.score-track').length).toBe(5);
    expect(text(element)).toContain('9 / 10');
    const damage = element.querySelector('[role="meter"]');
    expect(damage?.getAttribute('aria-valuenow')).toBe('9');
    expect(damage?.getAttribute('aria-valuemax')).toBe('10');
    const progress = element.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-label')).toBe('Sustain match collection');
    expect(progress?.getAttribute('aria-valuenow')).toBe('5');
    expect(progress?.getAttribute('aria-valuemax')).toBe('10');
    expect(progress?.querySelector<HTMLElement>('i')?.style.width).toBe('50%');
    expect(element.querySelectorAll('.score-track[aria-hidden="true"]').length).toBe(2);
  });

  it('shows empty collection bars at launch and no collection bars on failure', () => {
    const element = render(launch);
    expect(element.querySelectorAll('[role="progressbar"]').length).toBe(4);
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('caps match progress when another collection rule still holds a signal back', () => {
    const hero = scored.heroes[0];
    const element = render({ ...scored, heroes: [{ ...hero, sustain: { ...hero.sustain, matches: 30 } }] });
    const progress = element.querySelector('[role="progressbar"]');
    expect(progress?.getAttribute('aria-valuenow')).toBe('10');
    expect(progress?.querySelector<HTMLElement>('i')?.style.width).toBe('100%');
  });

  it('keeps the signal rows within narrow and desktop containers', () => {
    const element = render(scored);
    document.body.appendChild(element);
    try {
      for (const width of [280, 900]) {
        element.style.width = `${width}px`;
        const rows = element.querySelector<HTMLElement>('.signals');
        expect(rows).not.toBeNull();
        expect(rows?.scrollWidth).toBeLessThanOrEqual(width);
        for (const bar of element.querySelectorAll<HTMLElement>('.bar')) {
          expect(bar.getBoundingClientRect().width).toBeGreaterThan(0);
          expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(width);
        }
      }
    } finally {
      element.remove();
    }
  });

  it('says the scores failed, and offers no ability section, when they cannot be read', () => {
    const element = render(null);

    expect(text(element)).toContain('Scores cannot be loaded right now.');
    expect(element.querySelector('[role="progressbar"]')).toBeNull();
    expect(element.querySelector('h4')).toBeNull();
  });

  it('names the half-season standing in for the current one', () => {
    const element = render({
      ...scored,
      halfSeason: { label: 'Season 10' } as CommunityHeroScores['halfSeason'],
      inPlaceOf: { label: 'Season 10.5' } as CommunityHeroScores['inPlaceOf'],
    });

    expect(text(element.querySelector('.notice') as HTMLElement)).toContain("so these are Season 10's numbers");
  });
});
