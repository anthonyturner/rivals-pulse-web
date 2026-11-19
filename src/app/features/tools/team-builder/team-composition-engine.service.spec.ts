import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { CommunityHeroScores, HeroScores, HeroScoreStat } from '../../../../contracts/hero-scores.model';
import { heroOf } from '../../insights/hero-matchup.fixtures';
import { TeamCompositionEngineService } from './team-composition-engine.service';

const scored = (score: number): HeroScoreStat => ({
  status: 'scored',
  score,
  label: 'measured',
  matches: 42,
  contributors: null,
  oneContributorAboveHalf: null,
  measures: { damagePerMinute: 900 },
});

const collecting: HeroScoreStat = {
  status: 'collecting',
  score: null,
  label: 'measured',
  matches: 0,
  contributors: 0,
  oneContributorAboveHalf: false,
  measures: null,
};

const damageOnly = (hero: string, damage: number): HeroScores => ({
  hero,
  damage: scored(damage),
  sustain: collecting,
  ultimate: collecting,
  utility: collecting,
  abilities: [],
});

const answer = (heroes: HeroScores[]): CommunityHeroScores => ({
  status: 'ready',
  minimums: { matches: 10, contributors: 3, busiestContributorShare: 0.5, rankedHeroes: 5 },
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  heroes,
});

const angela = heroOf('angela', 'Angela', 'Vanguard');
const groot = heroOf('groot', 'Groot', 'Vanguard');
const mantis = heroOf('mantis', 'Mantis', 'Strategist');
const luna = heroOf('luna-snow', 'Luna Snow', 'Strategist');
const hela = heroOf('hela', 'Hela', 'Duelist');
const storm = heroOf('storm', 'Storm', 'Duelist');

describe('TeamCompositionEngineService', () => {
  let engine: TeamCompositionEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    engine = TestBed.inject(TeamCompositionEngineService);
  });

  describe('the lean', () => {
    it('is the highest signal among those covering more than half of the chosen heroes', () => {
      // Damage rests on 2 of 3 chosen heroes, Mobility on all 3.
      const summary = engine.analyzeTeam(
        [groot, mantis, hela],
        answer([damageOnly('mantis', 10), damageOnly('hela', 10)]),
        6,
      );

      expect(summary.lean).toBe('Damage');
      expect(summary.title).toBe('Damage Balanced Comp');
      expect(summary.description).toContain('damage-leaning balanced draft');
    });

    it('is not named from a signal covering exactly half of the chosen heroes', () => {
      const summary = engine.analyzeTeam([angela, mantis], answer([damageOnly('mantis', 10)]), 6);

      expect(summary.lean).toBeNull();
      expect(summary.title).toBe('Balanced Comp');
    });

    it('is never Mobility alone, which needs no match data', () => {
      const summary = engine.analyzeTeam([angela, mantis, hela], answer([]), 6);

      expect(summary.signals.find(({ type }) => type === 'Mobility')?.used).toBe(3);
      expect(summary.lean).toBeNull();
      expect(summary.description).not.toContain('leaning');
      expect(summary.strengths.join(' ')).not.toContain('Mobility gives');
    });

    it('is not named while the scores are loading or unreadable', () => {
      expect(engine.analyzeTeam([angela], undefined, 6).lean).toBeNull();
      expect(engine.analyzeTeam([angela], null, 6).lean).toBeNull();
    });
  });

  describe('the grade', () => {
    const team = (strategists: number) => [
      angela,
      groot,
      hela,
      storm,
      ...[mantis, luna].slice(0, strategists),
      ...(strategists === 1 ? [heroOf('magik', 'Magik', 'Duelist')] : []),
    ];

    it('comes from the role mix alone, whatever the scores say', () => {
      const withoutData = engine.analyzeTeam(team(2), answer([]), 6).grade;
      const withData = engine.analyzeTeam(team(2), answer([damageOnly('hela', 10)]), 6).grade;

      expect(withoutData).toBe('Excellent');
      expect(withData).toBe('Excellent');
    });

    it('rates a full team with one Strategist below one with two', () => {
      expect(engine.analyzeTeam(team(1), answer([]), 6).grade).toBe('Strong');
    });
  });
});
