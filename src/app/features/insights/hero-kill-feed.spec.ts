import {
  KILL_FEED_LIST_LENGTH,
  killPairMinimum,
  killPairSentence,
  killedBy,
  killsBandLabel,
  killsBy,
  topKillPairs,
} from './hero-kill-feed';
import { killPair, killsOf } from './community-extended.fixtures';

const KILLS = killsOf([
  killPair('hela', 'hulk', 250),
  killPair('storm', 'hulk', 100),
  killPair('hela', 'thor', 50),
  killPair('thor', 'hela', 25),
  killPair('hulk', 'hela', 10),
]);

describe('hero kill feed reads', () => {
  it('lists what a hero killed and what killed it, in the payload order', () => {
    expect(killsBy(KILLS, 'hela').map((pair) => pair.victim)).toEqual(['hulk', 'thor']);
    expect(killedBy(KILLS, 'hela').map((pair) => pair.killer)).toEqual(['thor', 'hulk']);
    expect(killedBy(KILLS, 'hulk').map((pair) => pair.killer)).toEqual(['hela', 'storm']);
  });

  it('is empty for a hero in no pair', () => {
    expect(killsBy(KILLS, 'loki')).toEqual([]);
    expect(killedBy(KILLS, 'loki')).toEqual([]);
  });

  it('never lists more than the payload holds per hero', () => {
    const many = killsOf(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((victim, index) => killPair('hela', victim, 1000 - index)),
    );

    expect(killsBy(many, 'hela').length).toBe(KILL_FEED_LIST_LENGTH);
  });

  it('takes the top pairs overall', () => {
    expect(topKillPairs(KILLS, 2).map((pair) => `${pair.killer}>${pair.victim}`)).toEqual(['hela>hulk', 'storm>hulk']);
    expect(topKillPairs(KILLS, 0)).toEqual([]);
  });

  it('states a band, never an exact count', () => {
    expect(killsBandLabel(25)).toBe('25+ seen kills');
    expect(killsBandLabel(1000)).toBe('1,000+ seen kills');
    expect(killPairSentence(killPair('hela', 'hulk', 100), 'Hela', 'Hulk')).toBe('Hela killed Hulk in 100+ seen kills.');
  });

  it('names the minimum in matches and in players', () => {
    expect(killPairMinimum(KILLS)).toBe(
      'A pair appears once it is in the kill feed of 10 recorded matches, recorded by at least 3 different players.',
    );
  });
});
