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

  it('says the scores failed, and offers no ability section, when they cannot be read', () => {
    const element = render(null);

    expect(text(element)).toContain('Scores cannot be loaded right now.');
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
