import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { buildHeroKeyResolver, heroProgress, heroXpCredits, type UploadedMatch } from '../src/server/hero-progress/hero-progress.ts';
import { matchXpBonuses } from '../src/server/hero-progress/hero-xp-bonuses.ts';
import type { HeroXpCarry, HeroXpCarryOver } from '../src/server/hero-progress/hero-xp-carry.ts';
import { heroGameIdEntries } from '../src/server/heroes/catalog/hero-game-ids.ts';

/**
 * The purge freezes hero XP in SQL (`freeze_hero_xp_carry_overs`) with the TypeScript rules copied into it, so the
 * two have to be held to the same numbers. `supabase/checks/hero_xp_carry_overs.sql` carries one fixture: matches,
 * and the totals they must freeze to. The check runs the SQL against it on the database; this reads the very same
 * text and runs the TypeScript against it in CI. A change to a rule that only one side makes fails one of them.
 */
const CHECK = new URL('../supabase/checks/hero_xp_carry_overs.sql', import.meta.url);
/** Any moment: only the gaps between matches matter, and they are whole milliseconds. */
const BASE_TIME = 1_700_000_000_000;

interface FixtureMatch {
  key: string;
  offsetMs: number;
  halfSeason: number;
  playModeId: number | null;
  isWin: boolean | null;
  heroId: number | null;
  figures: UploadedMatch['figures'];
}
interface Fixture {
  matches: FixtureMatch[];
  expected: {
    carryOvers: HeroXpCarryOver[];
    lastBonusWinOffsetMs: number;
    lastCountedOffsetMs: number;
    allTimeXpByHeroId: Record<string, number>;
  };
}

const text = readFileSync(CHECK, 'utf8');
const fixture: Fixture = JSON.parse(/\$fixture\$([\s\S]*?)\$fixture\$/.exec(text)?.[1] ?? 'null');
/** The purge freezes by the game's hero id; the id is its own key here. */
const byId = (gameId: number): string => String(gameId);
const uploaded = (matches: readonly FixtureMatch[]): UploadedMatch[] =>
  matches.map(({ key, offsetMs, halfSeason, playModeId, isWin, heroId, figures }) => ({
    matchKey: key,
    endedAt: BASE_TIME + offsetMs,
    halfSeason,
    playModeId,
    isWin,
    heroId,
    figures,
  }));

/** The purge deletes what ended before the cut-off, which is offset 0. */
const frozen = fixture.matches.filter(({ offsetMs }) => offsetMs < 0);
const held = fixture.matches.filter(({ offsetMs }) => offsetMs >= 0);
const carry: HeroXpCarry = {
  overs: fixture.expected.carryOvers,
  lastBonusWinAt: BASE_TIME + fixture.expected.lastBonusWinOffsetMs,
  lastCountedAt: BASE_TIME + fixture.expected.lastCountedOffsetMs,
};
const allTime = (progress: ReadonlyMap<string, { xp: number }>) => Object.fromEntries([...progress].map(([key, { xp }]) => [key, xp]));

describe('the hero XP freeze fixture', () => {
  it('is read from the check script and is not empty', () => {
    assert.ok(fixture.matches.length > 10);
    assert.ok(frozen.length > 0 && held.length > 0);
  });

  it('is frozen by the TypeScript rules to exactly the totals the SQL must give, per half-season and hero', () => {
    const totals = new Map<string, HeroXpCarryOver>();
    for (const credit of heroXpCredits(uploaded(frozen), byId)) {
      const key = `${credit.halfSeason}:${credit.key}`;
      const total = totals.get(key) ?? { halfSeason: credit.halfSeason!, heroId: Number(credit.key), baseXp: 0, timeXp: 0, bonusXp: 0 };
      totals.set(key, { ...total, baseXp: total.baseXp + credit.baseXp, timeXp: total.timeXp + credit.timeXp, bonusXp: total.bonusXp + credit.bonusXp });
    }

    assert.deepEqual(
      [...totals.values()].sort((a, b) => a.halfSeason - b.halfSeason || a.heroId - b.heroId),
      fixture.expected.carryOvers,
    );
  });

  it('leaves the bonus chains where the SQL must leave them: the last first win and the last counted match', () => {
    const counted = uploaded(frozen).filter(({ playModeId }) => playModeId === 0 || playModeId === 1);
    const bonuses = matchXpBonuses(counted.map(({ matchKey, endedAt, isWin }) => ({ matchKey, endedAt, won: isWin === true })));

    assert.equal(Math.max(...counted.filter(({ matchKey }) => bonuses.get(matchKey)?.firstWin).map(({ endedAt }) => endedAt)), carry.lastBonusWinAt);
    assert.equal(Math.max(...counted.map(({ endedAt }) => endedAt)), carry.lastCountedAt);
  });

  it('gives each hero the same all-time XP whole as it does frozen plus the matches still held: levels never fall', () => {
    const whole = heroProgress(uploaded(fixture.matches), undefined, byId);
    const afterPurge = heroProgress(uploaded(held), undefined, byId, carry);

    assert.deepEqual(allTime(whole), fixture.expected.allTimeXpByHeroId);
    assert.deepEqual(allTime(afterPurge), fixture.expected.allTimeXpByHeroId);
  });

  it('would give other XP without the chains, so it does test that they carry on across the purge', () => {
    const withoutChains = heroProgress(uploaded(held), undefined, byId, { ...carry, lastBonusWinAt: null, lastCountedAt: null });

    assert.notDeepEqual(allTime(withoutChains), fixture.expected.allTimeXpByHeroId);
  });

  it('covers both gap boundaries to the millisecond and a tie on end time', () => {
    const gaps = new Set(fixture.matches.map(({ offsetMs }) => offsetMs));

    assert.ok(gaps.has(-25_200_000) && gaps.has(-25_200_001), 'the 20 hour boundary, across the frozen matches');
    assert.ok(gaps.has(46_800_000) && gaps.has(46_799_999), 'the 20 hour boundary, across the purge');
    assert.ok(gaps.has(7_199_999) && gaps.has(14_399_999), 'the 2 hour boundary, among the matches held');
    assert.equal(new Set(frozen.map(({ offsetMs }) => offsetMs)).size, frozen.length - 1, 'one tie on end time');
  });
});

describe('a frozen total is keyed by the game hero id the site resolves on read', () => {
  it('maps every game hero id to its own hero key, so no two ids are merged by the resolver', () => {
    const resolve = buildHeroKeyResolver(heroGameIdEntries);
    const ids = heroGameIdEntries.flatMap(({ gameId, gameIdVariants }) => [gameId, ...(gameIdVariants ?? []).map(variant => variant.gameId)]);
    const keys = ids.map(resolve).filter((key): key is string => key !== null);

    assert.equal(new Set(keys).size, keys.length);
  });
});
