import type { SupabaseClient } from '@supabase/supabase-js';

import {
  deriveCommunityFigures,
  type CommunityFiguresSource,
  type HeroFigureRow,
} from './community-figures.ts';
import { deriveCommunityKills, type CommunityKillsSource } from './community-kills.ts';
import { deriveHeroScores, type FigureCount, type HeroScoresSource } from './hero-scores.ts';
import type { CommunityFigures } from '../../../contracts/community-figures.model.ts';
import type { CommunityKills } from '../../../contracts/community-kills.model.ts';
import type { CommunityHeroScores } from '../../../contracts/hero-scores.model.ts';
import { buildHeroRoleByGameId, heroGameIdEntries, heroSlugByGameId, listHeroRoles } from '../../heroes/catalog/index.ts';
import type { HalfSeasonStart } from '../../heroes/stats/hero-stats.ts';
import { answerReader, callReadFunction, getSupabaseClient, type AnswerReader } from '../../supabase/index.ts';

/**
 * The extended upload's numbers (damage, healing and damage blocked per minute, and the kill feed),
 * read through functions whose sums are only for the buckets the database lets through: at least 2
 * distinct recorders (and no limit on the busiest one). All are granted to the service role alone.
 */

export interface CommunityExtendedReadOptions {
  /** Defaults to the shared server client. */
  client?: SupabaseClient;
  now?: () => Date;
  /** One exact half-season instead of the current one; see `DeriveCommunityFiguresOptions`. */
  halfSeason?: number;
}

export interface CommunityFiguresReadOptions extends CommunityExtendedReadOptions {
  /** Hero id to role. By default read from `hero_content` through the shared Supabase client. */
  loadHeroRoles?: () => Promise<ReadonlyMap<string, string>>;
}

export const FIGURES_FUNCTION = 'read_community_hero_figures';
export const KILL_FEED_FUNCTION = 'read_community_kill_feed';
export const HERO_SCORES_FUNCTION = 'read_community_hero_scores';

const NO_FIGURES: CommunityFiguresSource = { halfSeasons: [], figures: [] };
const NO_KILLS: CommunityKillsSource = { halfSeasons: [], pairs: [] };
const NO_HERO_SCORES: HeroScoresSource = { halfSeasons: [], figures: [], abilities: [] };

function halfSeasonsOf(reader: AnswerReader, payload: Record<string, unknown>): HalfSeasonStart[] {
  return reader.recordsOf(payload['half_seasons'], 'half_seasons').map((row) => ({
    halfSeason: reader.numberOf(row, 'half_season'),
    startsAt: reader.stringOf(row, 'starts_at'),
  }));
}

/** Picks the known fields out of `read_community_hero_figures()` and rejects anything that is not a number. */
export function parseCommunityFiguresSource(body: unknown): CommunityFiguresSource {
  const reader = answerReader(FIGURES_FUNCTION);
  const payload = reader.answerOf(body);

  return {
    halfSeasons: halfSeasonsOf(reader, payload),
    figures: reader.recordsOf(payload['figures'], 'figures').map(
      (row): HeroFigureRow => ({
        halfSeason: reader.numberOf(row, 'half_season'),
        playModeId: reader.numberOf(row, 'play_mode_id'),
        gameHeroId: reader.numberOf(row, 'hero_id'),
        damageSum: reader.numberOf(row, 'damage_sum'),
        damageN: reader.numberOf(row, 'damage_n'),
        damageSeconds: reader.numberOf(row, 'damage_seconds'),
        healingSum: reader.numberOf(row, 'healing_sum'),
        healingN: reader.numberOf(row, 'healing_n'),
        healingSeconds: reader.numberOf(row, 'healing_seconds'),
        blockedSum: reader.numberOf(row, 'blocked_sum'),
        blockedN: reader.numberOf(row, 'blocked_n'),
        blockedSeconds: reader.numberOf(row, 'blocked_seconds'),
      }),
    ),
  };
}

/** Picks the known fields out of `read_community_kill_feed()` and rejects anything that is not a number. */
export function parseCommunityKillsSource(body: unknown): CommunityKillsSource {
  const reader = answerReader(KILL_FEED_FUNCTION);
  const payload = reader.answerOf(body);

  return {
    halfSeasons: halfSeasonsOf(reader, payload),
    pairs: reader.recordsOf(payload['pairs'], 'pairs').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      killerHero: reader.stringOf(row, 'killer_hero'),
      victimHero: reader.stringOf(row, 'victim_hero'),
      kills: reader.numberOf(row, 'kills'),
      matches: reader.numberOf(row, 'matches'),
    })),
  };
}

/** Picks the known fields out of `read_community_hero_scores()` and rejects anything of the wrong type. */
export function parseHeroScoresSource(body: unknown): HeroScoresSource {
  const reader = answerReader(HERO_SCORES_FUNCTION);
  const payload = reader.answerOf(body);
  const figure = (row: Record<string, unknown>, name: string): FigureCount => ({
    lines: reader.numberOf(row, `${name}_n`),
    contributors: reader.numberOf(row, `${name}_recorders`),
    busiestAboveHalf: reader.booleanOf(row, `${name}_busiest_above_half`),
    qualifies: reader.booleanOf(row, `${name}_qualifies`),
    sum: reader.numberOf(row, `${name}_sum`),
    seconds: reader.numberOf(row, `${name}_seconds`),
  });

  return {
    halfSeasons: halfSeasonsOf(reader, payload),
    figures: reader.recordsOf(payload['figures'], 'figures').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      playModeId: reader.numberOf(row, 'play_mode_id'),
      gameHeroId: reader.numberOf(row, 'hero_id'),
      damage: figure(row, 'damage'),
      healing: figure(row, 'healing'),
      blocked: figure(row, 'blocked'),
    })),
    abilities: reader.recordsOf(payload['abilities'], 'abilities').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      playModeId: reader.numberOf(row, 'play_mode_id'),
      gameHeroId: reader.numberOf(row, 'hero_id'),
      slot: reader.stringOf(row, 'slot'),
      lines: reader.numberOf(row, 'segments'),
      contributors: reader.numberOf(row, 'recorders'),
      busiestAboveHalf: reader.booleanOf(row, 'busiest_above_half'),
      qualifies: reader.booleanOf(row, 'qualifies'),
      usesSum: reader.numberOf(row, 'uses_sum'),
      usesTimedSum: reader.numberOf(row, 'uses_timed_sum'),
      seconds: reader.numberOf(row, 'seconds_sum'),
      killsAfterSum: reader.numberOf(row, 'kills_after_sum'),
      killsAfterN: reader.numberOf(row, 'kills_after_n'),
      assistsAfterSum: reader.numberOf(row, 'assists_after_sum'),
      assistsAfterN: reader.numberOf(row, 'assists_after_n'),
    })),
  };
}

/**
 * Damage, healing and damage blocked per minute for every role and hero. The role of a hero is the
 * one it has now (`hero_content`), except that a hero the game splits by role counts toward the
 * role that was played. A game hero id with no hero is left out and logged. Resolves to the empty
 * state while the read function is not in the database yet.
 */
export async function getCommunityFigures(options: CommunityFiguresReadOptions = {}): Promise<CommunityFigures> {
  const body = await callReadFunction(options.client ?? getSupabaseClient(), FIGURES_FUNCTION);
  const source = body === null ? NO_FIGURES : parseCommunityFiguresSource(body);
  const roleBySlug =
    source.figures.length === 0
      ? new Map<string, string>()
      : await (options.loadHeroRoles ?? (() => listHeroRoles(getSupabaseClient())))();
  const { figures, excludedGameIds } = deriveCommunityFigures(source, {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    roleByGameId: buildHeroRoleByGameId(heroGameIdEntries, roleBySlug),
    heroSlugByGameId,
  });

  if (excludedGameIds.length > 0) {
    console.warn(`Community figures left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return figures;
}

/** The 1 to 10 hero build scores, or the empty state while the read function is not in the database yet. */
export async function getCommunityHeroScores(options: CommunityExtendedReadOptions = {}): Promise<CommunityHeroScores> {
  const body = await callReadFunction(options.client ?? getSupabaseClient(), HERO_SCORES_FUNCTION);
  const { scores, excludedGameIds } = deriveHeroScores(body === null ? NO_HERO_SCORES : parseHeroScoresSource(body), {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    heroSlugByGameId,
  });

  if (excludedGameIds.length > 0) {
    console.warn(`Hero scores left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return scores;
}

/** The kill-feed counters, or the empty state while the read function is not in the database yet. */
export async function getCommunityKills(options: CommunityExtendedReadOptions = {}): Promise<CommunityKills> {
  const body = await callReadFunction(options.client ?? getSupabaseClient(), KILL_FEED_FUNCTION);

  return deriveCommunityKills(body === null ? NO_KILLS : parseCommunityKillsSource(body), {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    knownHeroes: new Set(heroGameIdEntries.map((entry) => entry.id)),
  });
}
