import { heroOf, matchup, matchupsOf } from '../../insights/hero-matchup.fixtures';
import { answersTo } from './dive-answers';

const angela = heroOf('angela', 'Angela', 'Vanguard');
const blackCat = heroOf('black-cat', 'Black Cat', 'Duelist');
const hulk = heroOf('hulk', 'Hulk', 'Vanguard');
const mantis = heroOf('mantis', 'Mantis', 'Strategist');
const peni = heroOf('peni-parker', 'Peni Parker', 'Vanguard');
const heroes = [angela, blackCat, hulk, mantis, peni];

describe('answersTo', () => {
  const matchups = matchupsOf([
    matchup('peni-parker', 'angela', 10, 12),
    matchup('peni-parker', 'black-cat', 9, 12),
    matchup('mantis', 'black-cat', 9, 12),
    matchup('hulk', 'angela', 3, 12),
  ]);

  it('puts the hero with a winning record against the most threats first', () => {
    const answers = answersTo([angela, blackCat], heroes, matchups);

    expect(answers.map((answer) => [answer.hero.name, answer.coveredThreats.map((threat) => threat.name)])).toEqual([
      ['Peni Parker', ['Angela', 'Black Cat']],
      ['Mantis', ['Black Cat']],
    ]);
  });

  it('leaves out a hero with a losing record and never offers a threat as its own answer', () => {
    const answers = answersTo([angela], heroes, matchups);

    expect(answers.map((answer) => answer.hero.name)).toEqual(['Peni Parker']);
  });

  it('is empty with no threats chosen, or no matchup that qualifies', () => {
    expect(answersTo([], heroes, matchups)).toEqual([]);
    expect(answersTo([angela], heroes, matchupsOf([]))).toEqual([]);
  });

  it('breaks a tie by hero name only, and keeps only the limit', () => {
    const tied = matchupsOf([
      matchup('mantis', 'angela', 9, 12),
      matchup('hulk', 'angela', 9, 12),
      matchup('black-cat', 'angela', 9, 12),
    ]);

    expect(answersTo([angela], heroes, tied).map((answer) => answer.hero.name)).toEqual(['Black Cat', 'Hulk', 'Mantis']);
    expect(answersTo([angela], heroes, tied, 2).map((answer) => answer.hero.name)).toEqual(['Black Cat', 'Hulk']);
  });
});
