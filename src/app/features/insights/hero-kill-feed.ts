import type { CommunityKillPair, CommunityKills } from '../../../contracts/community-kills.model';
import { countLabel } from '../../shared/utilities/stat-labels';

/**
 * The reads both kill-feed surfaces share. A pair is "seen kills": what the feed of a recorder's own
 * game showed, which misses kills that recorder did not see. It describes the feed; it is a different
 * measure from the win-rate records and says nothing about whom to pick or ban.
 */

/** Pairs listed for one hero on each side, and in the community summary. The payload holds no more per hero. */
export const KILL_FEED_LIST_LENGTH = 5;

/** The pairs where `heroId` is the killer, most seen kills first (the payload's order). */
export function killsBy(kills: CommunityKills, heroId: string): CommunityKillPair[] {
  return kills.pairs.filter((pair) => pair.killer === heroId).slice(0, KILL_FEED_LIST_LENGTH);
}

/** The pairs where `heroId` is the victim, most seen kills first. */
export function killedBy(kills: CommunityKills, heroId: string): CommunityKillPair[] {
  return kills.pairs.filter((pair) => pair.victim === heroId).slice(0, KILL_FEED_LIST_LENGTH);
}

/** The pairs with the most seen kills across every hero. */
export function topKillPairs(kills: CommunityKills, limit: number): CommunityKillPair[] {
  return kills.pairs.slice(0, Math.max(0, limit));
}

/** "25+ seen kills": a band, never the exact count. */
export function killsBandLabel(band: number): string {
  return `${band.toLocaleString('en-US')}+ seen kills`;
}

/** The sentence a row carries as its tooltip, such as "Hela killed Hulk in 25+ seen kills". */
export function killPairSentence(pair: CommunityKillPair, killerName: string, victimName: string): string {
  return `${killerName} killed ${victimName} in ${killsBandLabel(pair.killsBand)}.`;
}

/** What a pair needs before it is listed, in words: its matches and the players who recorded them. */
export function killPairMinimum(kills: CommunityKills): string {
  const { pairMatches, recorders } = kills.minimums;

  return `A pair appears once it is in the kill feed of ${countLabel(pairMatches, 'recorded match', 'recorded matches')}, recorded by at least ${recorders} different players.`;
}

/** The sentence that keeps the kill feed apart from the win-rate records. */
export const KILL_FEED_CAVEAT =
  "Seen kills come from the kill feed a Rivals Pulse player's game showed them, so they miss kills that player did not see. They are not every kill, and they are a separate measure from the win-rate records.";
