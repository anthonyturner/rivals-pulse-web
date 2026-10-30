/**
 * The optional part of an uploaded match that newer overlays add: the recorder's own damage,
 * healing, damage blocked and time per hero, and the match's kill feed (issue 176). Shipped
 * overlays send neither, and `readExtendedUpload` then returns null.
 *
 * A value that is malformed is dropped for that field alone; nothing here throws, so a bad new
 * field can never fail the match. Damage, healing and blocked are read from `match_player` only:
 * the same figures on any roster line are another player's and are never read (ADR-0011).
 * No Deno or Supabase imports, so `node --test` runs its specs.
 */
import { asRecord, readUid, type JsonRecord } from './match-payload.ts';

export interface HeroFigure {
  /** The game's hero id, the same id space as a scoreboard line's `cur_hero_id`. */
  hero_id: number;
  /** Each figure is null when absent or malformed, never 0 in its place. */
  seconds: number | null;
  damage_dealt: number | null;
  healing: number | null;
  damage_blocked: number | null;
}

/** How often one hero killed another in the match, by hero slug. No player is named. */
export interface HeroKill {
  killer: string;
  victim: string;
  kills: number;
}

export interface ExtendedUpload {
  /** The recorder's uid, which ties their figures to their own scoreboard line; null without one. */
  recorder_uid: string | null;
  hero_figures: HeroFigure[];
  hero_kills: HeroKill[];
}

/** A player swaps hero a handful of times in a match; more than this is not a real list. */
export const MAX_HERO_FIGURES = 20;
/** A 6v6 lobby has at most 6 x 6 hero pairs fighting, and a hero can fight its own kind. */
export const MAX_HERO_KILL_PAIRS = 150;
export const MAX_KILLS_PER_PAIR = 999;
const MAX_INT4 = 2_147_483_647;
/** Longest match a custom lobby can run, in seconds. */
const MAX_SEGMENT_SECONDS = 7_200;
/** Far above any real match (the heaviest is about 150,000); it stops an absurd value from skewing a sum. */
const MAX_FIGURE = 1_000_000;
const HERO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 40;

export function readExtendedUpload(match: JsonRecord): ExtendedUpload | null {
  const local = asRecord(match['match_player']);
  const recorderUid = readUid(local?.['player_uid']);
  // Without a uid the figures cannot be tied to the recorder's line, so they are not kept.
  const heroFigures = recorderUid === null ? [] : readHeroFigures(local?.['hero_segments']);
  const heroKills = readHeroKills(match['hero_kills']);

  if (heroFigures.length === 0 && heroKills.length === 0) return null;
  return { recorder_uid: recorderUid, hero_figures: heroFigures, hero_kills: heroKills };
}

function readHeroFigures(value: unknown): HeroFigure[] {
  if (!Array.isArray(value)) return [];

  const figures = new Map<number, HeroFigure>();
  for (const entry of value) {
    const segment = asRecord(entry);
    const heroId = readWhole(segment?.['hero_id'], MAX_INT4);
    if (segment === null || heroId === null || heroId === 0 || figures.has(heroId)) continue;

    const figure: HeroFigure = {
      hero_id: heroId,
      seconds: readWhole(segment['seconds'], MAX_SEGMENT_SECONDS),
      damage_dealt: readWhole(segment['damage_dealt'], MAX_FIGURE),
      healing: readWhole(segment['healing'], MAX_FIGURE),
      damage_blocked: readWhole(segment['damage_blocked'], MAX_FIGURE),
    };
    if (figure.seconds === null && figure.damage_dealt === null && figure.healing === null && figure.damage_blocked === null) {
      continue;
    }
    figures.set(heroId, figure);
    if (figures.size === MAX_HERO_FIGURES) break;
  }
  return [...figures.values()];
}

function readHeroKills(value: unknown): HeroKill[] {
  // A feed with more pairs than a lobby can produce is not a real one, so none of it is trusted.
  if (!Array.isArray(value) || value.length > MAX_HERO_KILL_PAIRS) return [];

  const pairs = new Map<string, HeroKill>();
  for (const entry of value) {
    const record = asRecord(entry);
    const killer = readSlug(record?.['killer']);
    const victim = readSlug(record?.['victim']);
    const kills = readKills(record?.['kills']);
    if (killer === null || victim === null || kills === null) continue;

    // Slugs never contain a space, so the space cannot join two different pairs into one key.
    const key = `${killer} ${victim}`;
    const known = pairs.get(key);
    if (known) known.kills = Math.min(MAX_KILLS_PER_PAIR, known.kills + kills);
    else pairs.set(key, { killer, victim, kills });
  }
  return [...pairs.values()];
}

function readSlug(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const slug = value.trim().toLowerCase();
  return slug.length <= MAX_SLUG_LENGTH && HERO_SLUG.test(slug) ? slug : null;
}

/** A kill count is counted, not measured: a fraction is a bad value, not a number to round. */
function readKills(value: unknown): number | null {
  const kills = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof kills === 'number' && Number.isInteger(kills) && kills >= 1 && kills <= MAX_KILLS_PER_PAIR ? kills : null;
}

/** A finite figure of 0 to `max`, rounded to a whole number; a number sent as a string counts, anything else is null. */
function readWhole(value: unknown, max: number): number | null {
  const numeric = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null;
  const whole = Math.round(numeric);
  return whole >= 0 && whole <= max ? whole : null;
}
