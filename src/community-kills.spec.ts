import {
  COMMUNITY_KILLS_MINIMUMS,
  KILL_FEED_PAIRS_PER_HERO,
  KILL_VOLUME_BANDS,
  deriveCommunityKills,
  killVolumeBand,
  type KillPairRow,
} from './community-kills';
import type { CommunityKills } from './contracts/community-kills.model';

const NOW = new Date('2026-10-30T12:00:00Z');
const { pairMatches } = COMMUNITY_KILLS_MINIMUMS;

const HALF_SEASONS = [
  { halfSeason: 10, startsAt: '2026-09-11T09:00:00Z' },
  { halfSeason: 10.5, startsAt: '2026-10-09T09:00:00Z' },
];
const HEROES = new Set(['hela', 'hulk', 'thor', 'storm', 'loki', 'venom', 'magik', 'psylocke', 'rocket-raccoon']);

function pair(killerHero: string, victimHero: string, kills: number, matches = pairMatches, halfSeason = 10.5): KillPairRow {
  return { halfSeason, killerHero, victimHero, kills, matches };
}

function derive(pairs: KillPairRow[], extra: { halfSeason?: number } = {}): CommunityKills {
  return deriveCommunityKills({ halfSeasons: HALF_SEASONS, pairs }, { now: NOW, knownHeroes: HEROES, ...extra });
}

describe('killVolumeBand', () => {
  it('is the largest band reached, and null below the smallest', () => {
    expect(killVolumeBand(0)).toBeNull();
    expect(killVolumeBand(KILL_VOLUME_BANDS[0] - 1)).toBeNull();
    expect(killVolumeBand(10)).toBe(10);
    expect(killVolumeBand(99)).toBe(50);
    expect(killVolumeBand(100)).toBe(100);
    expect(killVolumeBand(1_000_000)).toBe(KILL_VOLUME_BANDS.at(-1)!);
  });
});

describe('deriveCommunityKills', () => {
  it('is the designed empty state when nothing has been counted', () => {
    const result = derive([]);

    expect(result.status).toBe('not-enough-data');
    expect(result.minimums).toEqual({ ...COMMUNITY_KILLS_MINIMUMS });
    expect(result.pairs).toEqual([]);
    expect(result.halfSeason?.id).toBe(10.5);
  });

  it('is empty before any half-season exists', () => {
    const result = deriveCommunityKills({ halfSeasons: [], pairs: [] }, { now: NOW, knownHeroes: HEROES });

    expect(result.status).toBe('not-enough-data');
    expect(result.halfSeason).toBeNull();
  });

  it('lists a pair at its minimum matches and not one match below', () => {
    expect(derive([pair('hela', 'hulk', 40, pairMatches - 1)]).pairs).toEqual([]);
    expect(derive([pair('hela', 'hulk', 40, pairMatches)]).pairs).toEqual([
      { killer: 'hela', victim: 'hulk', killsBand: 25 },
    ]);
  });

  it('orders by seen kills, most first, then by hero id, and shows only the band', () => {
    const result = derive([
      pair('hulk', 'thor', 30),
      pair('hela', 'storm', 120),
      pair('hela', 'loki', 30),
      pair('hela', 'hulk', 30),
    ]);

    expect(result.pairs).toEqual([
      { killer: 'hela', victim: 'storm', killsBand: 100 },
      { killer: 'hela', victim: 'hulk', killsBand: 25 },
      { killer: 'hela', victim: 'loki', killsBand: 25 },
      { killer: 'hulk', victim: 'thor', killsBand: 25 },
    ]);
  });

  it('keeps each hero to its best pairs as killer and as victim, and drops the rest', () => {
    expect(KILL_FEED_PAIRS_PER_HERO).toBe(5);

    const victims = ['hulk', 'thor', 'storm', 'loki', 'venom', 'magik', 'psylocke'];
    // Hela kills seven heroes, most of Hulk down to the least of Psylocke; each victim has only
    // Hela as a killer, so every pair is in its victim's list and stays.
    const alone = derive(victims.map((victim, index) => pair('hela', victim, 200 - index * 10)));

    expect(alone.pairs.length).toBe(7);

    // Hela kills five heroes more than Magik and five heroes kill Magik more than Hela does, so
    // Hela's pair with Magik is in neither Hela's best five nor Magik's best five.
    const crowded = derive([
      ...['hulk', 'thor', 'storm', 'loki', 'venom'].map((victim, index) => pair('hela', victim, 200 - index * 10)),
      ...['rocket-raccoon', 'hulk', 'thor', 'storm', 'loki'].map((killer, index) =>
        pair(killer, 'magik', 500 - index * 10),
      ),
      pair('hela', 'magik', 100),
    ]);

    expect(crowded.pairs.length).toBe(10);
    expect(crowded.pairs.some((entry) => entry.killer === 'hela' && entry.victim === 'magik')).toBeFalse();
    expect(crowded.pairs.filter((entry) => entry.victim === 'magik').length).toBe(5);
  });

  it('leaves out a pair with a hero this site does not know', () => {
    expect(derive([pair('hela', 'mystery-hero', 50), pair('mystery-hero', 'hulk', 50)]).status).toBe('not-enough-data');
  });

  describe('half-seasons', () => {
    it('stands the previous half-season in while the current one lists no pair', () => {
      const result = derive([pair('hela', 'hulk', 40, pairMatches, 10), pair('hela', 'thor', 40, pairMatches - 1)]);

      expect(result.halfSeason?.id).toBe(10);
      expect(result.inPlaceOf?.id).toBe(10.5);
      expect(result.pairs.map((entry) => entry.victim)).toEqual(['hulk']);
    });

    it('shows exactly the half-season asked for, with no fall-back', () => {
      const rows = [pair('hela', 'hulk', 40, pairMatches, 10)];

      expect(derive(rows, { halfSeason: 10 }).pairs.length).toBe(1);
      expect(derive(rows, { halfSeason: 10.5 }).status).toBe('not-enough-data');
      expect(derive(rows, { halfSeason: 11 }).halfSeason).toBeNull();
    });
  });

  describe('the public payload', () => {
    const ready = derive([pair('hela', 'hulk', 137, 41), pair('thor', 'hela', 62, 20)]);

    it('publishes only the allow-listed keys, with no name, id or per-player field anywhere', () => {
      expect(ready.status).toBe('ready');
      expect(Object.keys(ready).sort()).toEqual(['halfSeason', 'halfSeasons', 'inPlaceOf', 'minimums', 'pairs', 'status']);
      expect(Object.keys(ready.minimums).sort()).toEqual(['pairMatches', 'recorders']);
      expect(Object.keys(ready.halfSeason!).sort()).toEqual(['endsAt', 'id', 'label', 'startsAt']);
      expect(Object.keys(ready.pairs[0]).sort()).toEqual(['killer', 'killsBand', 'victim']);
      expect(JSON.stringify(ready)).not.toMatch(/uid|fingerprint|recorder_|player|"name"/);
    });

    it('publishes a band, never the exact seen kills or the matches behind them', () => {
      const numbers = JSON.stringify(ready).match(/\d+(\.\d+)?/g)?.map(Number) ?? [];

      expect(ready.pairs.map((entry) => entry.killsBand)).toEqual([100, 50]);
      expect(numbers).not.toContain(137);
      expect(numbers).not.toContain(62);
      expect(numbers).not.toContain(41);
      expect(numbers).not.toContain(20);
    });
  });
});
