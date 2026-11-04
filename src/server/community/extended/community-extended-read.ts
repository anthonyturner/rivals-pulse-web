import type { SupabaseClient } from '@supabase/supabase-js';

import { aggregatePayloadReader } from '../matches/aggregate-payload.ts';
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
import { getSupabaseClient } from '../../supabase/index.ts';

/**
 * The extended upload's numbers (damage, healing and damage blocked per minute, and the kill feed),
 * read through two functions that return only the buckets the database lets through: at least 3
 * distinct recorders and none above half of a bucket. Both are granted to the service role alone.
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
const READ_TIMEOUT_MS = 5000;

// What Postgres and PostgREST answer when the migration has not been applied yet: PGRST202 is "no
// such function in the schema cache", 42883 an undefined function and 42P01 an undefined table.
const NOT_APPLIED_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883', '42P01']);

const NO_FIGURES: CommunityFiguresSource = { halfSeasons: [], figures: [] };
const NO_KILLS: CommunityKillsSource = { halfSeasons: [], pairs: [] };
const NO_HERO_SCORES: HeroScoresSource = { halfSeasons: [], figures: [], abilities: [] };

/**
 * Calls one read function with the server's service-role client. Resolves to null while the
 * migration is not applied, which is the designed "not enough data yet" state; any other failure (a
 * refused key, a server error, a timeout) throws, so an outage is never hidden behind that state.
 */
async function callReadFunction(client: SupabaseClient, functionName: string): Promise<unknown> {
  const { data, error } = await client
    .rpc(functionName)
    .retry(false)
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  if (error) {
    if (error.code !== undefined && NOT_APPLIED_CODES.has(error.code)) {
      console.warn(`${functionName} is not available yet: the extended aggregates are not applied.`);

      return null;
    }

    throw new Error(`${functionName} failed${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  }

  return data;
}

function halfSeasonsOf(reader: ReturnType<typeof aggregatePayloadReader>, payload: Record<string, unknown>): HalfSeasonStart[] {
  return reader.list(payload['half_seasons'], 'half_seasons').map((row) => ({
    halfSeason: reader.number(row, 'half_season'),
    startsAt: reader.string(row, 'starts_at'),
  }));
}

/** Picks the known fields out of `read_community_hero_figures()` and rejects anything that is not a number. */
export function parseCommunityFiguresSource(body: unknown): CommunityFiguresSource {
  const reader = aggregatePayloadReader(FIGURES_FUNCTION);
  const payload = reader.object(body, 'the answer');

  return {
    halfSeasons: halfSeasonsOf(reader, payload),
    figures: reader.list(payload['figures'], 'figures').map(
      (row): HeroFigureRow => ({
        halfSeason: reader.number(row, 'half_season'),
        playModeId: reader.number(row, 'play_mode_id'),
        gameHeroId: reader.number(row, 'hero_id'),
        damageSum: reader.number(row, 'damage_sum'),
        damageN: reader.number(row, 'damage_n'),
        damageSeconds: reader.number(row, 'damage_seconds'),
        healingSum: reader.number(row, 'healing_sum'),
        healingN: reader.number(row, 'healing_n'),
        healingSeconds: reader.number(row, 'healing_seconds'),
        blockedSum: reader.number(row, 'blocked_sum'),
        blockedN: reader.number(row, 'blocked_n'),
        blockedSeconds: reader.number(row, 'blocked_seconds'),
      }),
    ),
  };
}

/** Picks the known fields out of `read_community_kill_feed()` and rejects anything that is not a number. */
export function parseCommunityKillsSource(body: unknown): CommunityKillsSource {
  const reader = aggregatePayloadReader(KILL_FEED_FUNCTION);
  const payload = reader.object(body, 'the answer');

  return {
    halfSeasons: halfSeasonsOf(reader, payload),
    pairs: reader.list(payload['pairs'], 'pairs').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      killerHero: reader.string(row, 'killer_hero'),
      victimHero: reader.string(row, 'victim_hero'),
      kills: reader.number(row, 'kills'),
      matches: reader.number(row, 'matches'),
    })),
  };
}

/** Picks the known fields out of `read_community_hero_scores()` and rejects anything of the wrong type. */
export function parseHeroScoresSource(body: unknown): HeroScoresSource {
  const reader = aggregatePayloadReader(HERO_SCORES_FUNCTION);
  const payload = reader.object(body, 'the answer');
  const figure = (row: Record<string, unknown>, name: string): FigureCount => ({
    lines: reader.number(row, `${name}_n`),
    contributors: reader.number(row, `${name}_recorders`),
    busiestAboveHalf: reader.boolean(row, `${name}_busiest_above_half`),
    qualifies: reader.boolean(row, `${name}_qualifies`),
    sum: reader.number(row, `${name}_sum`),
    seconds: reader.number(row, `${name}_seconds`),
  });

  return {
    halfSeasons: halfSeasonsOf(reader, payload),
    figures: reader.list(payload['figures'], 'figures').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      playModeId: reader.number(row, 'play_mode_id'),
      gameHeroId: reader.number(row, 'hero_id'),
      damage: figure(row, 'damage'),
      healing: figure(row, 'healing'),
      blocked: figure(row, 'blocked'),
    })),
    abilities: reader.list(payload['abilities'], 'abilities').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      playModeId: reader.number(row, 'play_mode_id'),
      gameHeroId: reader.number(row, 'hero_id'),
      slot: reader.string(row, 'slot'),
      lines: reader.number(row, 'segments'),
      contributors: reader.number(row, 'recorders'),
      busiestAboveHalf: reader.boolean(row, 'busiest_above_half'),
      qualifies: reader.boolean(row, 'qualifies'),
      usesSum: reader.number(row, 'uses_sum'),
      usesTimedSum: reader.number(row, 'uses_timed_sum'),
      seconds: reader.number(row, 'seconds_sum'),
      killsAfterSum: reader.number(row, 'kills_after_sum'),
      killsAfterN: reader.number(row, 'kills_after_n'),
      assistsAfterSum: reader.number(row, 'assists_after_sum'),
      assistsAfterN: reader.number(row, 'assists_after_n'),
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
