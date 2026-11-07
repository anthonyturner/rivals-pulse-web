import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Hero } from '../hero.model';
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

const hela: Hero = {
  id: 'hela', name: 'Hela', role: 'Duelist', difficulty: 3,
  summary: 'Ranged pressure.', playstyle: 'Hold an angle while your team advances.',
  strengths: ['Ranged damage', 'Finishing pressure'], weaknesses: ['Needs clear sightlines'],
  counters: [], synergies: [], abilities: [], imageUrl: '/images/heroes/hela.png',
};

describe('HeroBuildSignalsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
  });

  function render(scores: CommunityHeroScores | null | undefined, hero = hela) {
    const fixture = TestBed.createComponent(HeroBuildSignalsComponent);
    fixture.componentRef.setInput('hero', hero);
    fixture.componentRef.setInput('scores', scores);
    fixture.detectChanges();
    return fixture;
  }
  const text = (element: HTMLElement): string => element.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('leads with existing hero guidance before the score evidence', () => {
    const element: HTMLElement = render(scored).nativeElement;
    expect(text(element.querySelector('.team-intro') as HTMLElement)).toContain(hela.playstyle);
    expect(text(element.querySelector('.team-gains') as HTMLElement)).toContain('Ranged damage');
    expect(text(element.querySelector('.team-cover') as HTMLElement)).toContain('Needs clear sightlines');
    expect(element.querySelectorAll('.signal-choice').length).toBe(5);
    expect(text(element.querySelector('.signal-evidence') as HTMLElement)).toContain('1,180 damage per minute');
    expect(element.querySelectorAll('.signal-choice[aria-pressed="true"]').length).toBe(1);
  });

  it('reveals the selected signal collection rules and estimates on click', () => {
    const fixture = render(scored);
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.signal-choice')[1].click();
    fixture.detectChanges();
    expect(text(element.querySelector('.signal-evidence') as HTMLElement)).toContain('5 of 10 matches, 2 of 3 players');
    expect(element.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('5');
    element.querySelectorAll<HTMLButtonElement>('.signal-choice')[3].click();
    fixture.detectChanges();
    expect(text(element.querySelector('.signal-evidence') as HTMLElement)).toContain('This is not a low score.');
    expect(element.querySelector('.signal-evidence .estimated .source')?.textContent).toBe('Estimated');
  });

  it('keeps ability use behind a native expandable section', () => {
    const element: HTMLElement = render(scored).nativeElement;
    const details = element.querySelector('details.ability-usage');
    expect(details?.hasAttribute('open')).toBeFalse();
    expect(text(details as HTMLElement)).toContain('Goddess of Death Q');
    expect(text(details as HTMLElement)).toContain('not whether it hit anyone');
  });

  it('keeps kit mobility available without inventing match scores while loading or unavailable', () => {
    for (const scores of [undefined, null, launch]) {
      const fixture = render(scores);
      const element: HTMLElement = fixture.nativeElement;
      expect(text(element.querySelector('.signal-evidence') as HTMLElement)).toContain(
        scores === undefined ? 'Loading' : scores === null ? 'Scores cannot be loaded right now.' : '0 of 10 matches',
      );
      element.querySelectorAll<HTMLButtonElement>('.signal-choice')[4].click();
      fixture.detectChanges();
      expect(element.querySelector('[role="meter"]')).not.toBeNull();
      expect(text(element.querySelector('.signal-evidence') as HTMLElement)).toContain('Hero kit');
      fixture.destroy();
    }
  });

  it('updates guidance and resets the signal selection when the hero changes', () => {
    const fixture = render(scored);
    const element: HTMLElement = fixture.nativeElement;
    element.querySelectorAll<HTMLButtonElement>('.signal-choice')[4].click();
    fixture.detectChanges();
    fixture.componentRef.setInput('hero', { ...hela, id: 'mantis', name: 'Mantis', playstyle: '', strengths: [], weaknesses: [] });
    fixture.detectChanges();
    expect(element.querySelector('.signal-choice[aria-pressed="true"]')?.textContent).toContain('Damage');
    expect(text(element)).not.toContain(hela.playstyle);
    expect(text(element)).toContain('Team contribution notes are not available yet.');
    expect(text(element)).toContain('Team coverage notes are not available yet.');
  });

  it('names the half-season standing in for the current one', () => {
    const element: HTMLElement = render({ ...scored,
      halfSeason: { label: 'Season 10' } as CommunityHeroScores['halfSeason'],
      inPlaceOf: { label: 'Season 10.5' } as CommunityHeroScores['inPlaceOf'],
    }).nativeElement;
    expect(text(element.querySelector('.notice') as HTMLElement)).toContain("so these are Season 10's numbers");
  });

  it('fits narrow containers in both themes', () => {
    const element: HTMLElement = render(scored).nativeElement;
    document.body.appendChild(element);
    try {
      for (const theme of ['light', 'dark']) {
        document.documentElement.setAttribute('data-theme', theme);
        for (const width of [280, 900]) {
          element.style.width = `${width}px`;
          for (const selector of ['.team-cards', '.signal-choices', '.signal-evidence']) {
            expect(element.querySelector<HTMLElement>(selector)?.scrollWidth).toBeLessThanOrEqual(width);
          }
        }
      }
    } finally {
      document.documentElement.removeAttribute('data-theme');
      element.remove();
    }
  });
});
