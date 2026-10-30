import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { heroOf, matchup, matchupsOf } from '../../insights/hero-matchup.fixtures';
import { CounterEngineService } from './counter-engine.service';

const angela = heroOf('angela', 'Angela', 'Vanguard');
const blackCat = heroOf('black-cat', 'Black Cat', 'Duelist');
const hulk = heroOf('hulk', 'Hulk', 'Vanguard');
const mantis = heroOf('mantis', 'Mantis', 'Strategist');
const peni = heroOf('peni-parker', 'Peni Parker', 'Vanguard');
const heroes = [angela, blackCat, hulk, mantis, peni];

describe('CounterEngineService', () => {
  let engine: CounterEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    engine = TestBed.inject(CounterEngineService);
  });

  it('filters by role and by hero name, and no longer by the old counter lists', () => {
    expect(engine.filterHeroes(heroes, 'Duelist', '').map((entry) => entry.id)).toEqual(['black-cat']);
    expect(engine.filterHeroes(heroes, 'All', 'pen').map((entry) => entry.id)).toEqual(['peni-parker']);
    expect(engine.filterHeroes(heroes, 'All', 'hulk').map((entry) => entry.id)).toEqual(['hulk']);
  });

  it('lists the heroes with a winning record against a hero, and the heroes it has one against', () => {
    const matchups = matchupsOf([
      matchup('peni-parker', 'angela', 10, 12),
      matchup('mantis', 'angela', 7, 12),
      matchup('angela', 'hulk', 9, 12),
      matchup('angela', 'peni-parker', 2, 12),
    ]);

    expect(engine.winningAgainst(angela, heroes, matchups).map((card) => card.hero.name)).toEqual(['Mantis', 'Peni Parker']);
    expect(engine.winningFor(angela, heroes, matchups).map((card) => card.hero.name)).toEqual(['Hulk']);
    expect(engine.winningAgainst(angela, heroes, matchups)[1].winRate).toBe('83.3%');
  });

  it('counts matchups for the picker, with a plain line when there are none', () => {
    const matchups = matchupsOf([matchup('angela', 'hulk', 9, 12), matchup('angela', 'mantis', 3, 12)]);

    expect(engine.matchupCountLabel(angela, matchups)).toBe('2 matchups');
    expect(engine.matchupCountLabel(hulk, matchups)).toBe('No matchup yet');
    expect(engine.matchupCountLabel(angela, matchupsOf([matchup('angela', 'hulk', 9, 12)]))).toBe('1 matchup');
  });

  it('says Loading or Unavailable on a tile, not "No matchup yet", while matchups load or fail', () => {
    expect(engine.matchupCountLabel(angela, undefined)).toBe('Loading');
    expect(engine.matchupCountLabel(angela, null)).toBe('Unavailable');
  });

  describe('answersTo', () => {
    const matchups = matchupsOf([
      matchup('peni-parker', 'angela', 10, 12),
      matchup('peni-parker', 'black-cat', 9, 12),
      matchup('mantis', 'black-cat', 9, 12),
      matchup('hulk', 'angela', 3, 12),
    ]);

    it('puts the hero with a winning record against the most threats first', () => {
      const answers = engine.answersTo([angela, blackCat], heroes, matchups);

      expect(answers.map((answer) => [answer.hero.name, answer.coveredThreats.map((threat) => threat.name)])).toEqual([
        ['Peni Parker', ['Angela', 'Black Cat']],
        ['Mantis', ['Black Cat']],
      ]);
    });

    it('leaves out a hero with a losing record and never offers a threat as its own answer', () => {
      const answers = engine.answersTo([angela], heroes, matchups);

      expect(answers.map((answer) => answer.hero.name)).toEqual(['Peni Parker']);
    });

    it('is empty with no threats chosen, or no matchup that qualifies', () => {
      expect(engine.answersTo([], heroes, matchups)).toEqual([]);
      expect(engine.answersTo([angela], heroes, matchupsOf([]))).toEqual([]);
    });

    it('breaks a tie by hero name only, and keeps only the limit', () => {
      const tied = matchupsOf([
        matchup('mantis', 'angela', 9, 12),
        matchup('hulk', 'angela', 9, 12),
        matchup('black-cat', 'angela', 9, 12),
      ]);

      expect(engine.answersTo([angela], heroes, tied).map((answer) => answer.hero.name)).toEqual(['Black Cat', 'Hulk', 'Mantis']);
      expect(engine.answersTo([angela], heroes, tied, 2).map((answer) => answer.hero.name)).toEqual(['Black Cat', 'Hulk']);
    });
  });
});
