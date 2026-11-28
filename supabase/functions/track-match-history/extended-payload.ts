/**
 * The optional part of an uploaded match that newer overlays add: the recorder's own damage,
 * healing, damage blocked and time per hero, the match's kill feed (issue 176), and the recorder's
 * own ability and ultimate use counts (issue 457), and each player's hero timeline (issue 654).
 * Shipped overlays send none, and
 * `readExtendedUpload` then returns null.
 *
 * A value that is malformed is dropped for that field alone; nothing here throws, so a bad new
 * field can never fail the match. Damage, healing and blocked are read from `match_player` only:
 * the same figures on any roster line are another player's and are never read (ADR-0011). The same
 * goes for ability counts.
 * No Deno or Supabase imports, so `node --test` runs its specs.
 */
import { asRecord, readTeam, readUid, type JsonRecord, type ParticipantRow } from './match-payload.ts';

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

/** How often the recorder used one ability slot on one hero, and what followed. No other player is named. */
export interface HeroAbilityUse {
  hero_id: number;
  slot: AbilitySlot;
  uses: number;
  /** Null when absent or malformed, never 0 in its place. */
  kills_after: number | null;
  assists_after: number | null;
}

/** One hero pick in a timeline: `at_second` counts from the start of the match. */
export interface HeroPick {
  hero_id: number;
  at_second: number;
}

/** One player's heroes in the order they were played. It carries no uid and no name. */
export interface HeroTimeline {
  team: number;
  picks: HeroPick[];
}

export interface ExtendedUpload {
  /** The recorder's uid, which ties their figures to their own scoreboard line; null without one. */
  recorder_uid: string | null;
  hero_figures: HeroFigure[];
  hero_kills: HeroKill[];
  hero_ability_uses: HeroAbilityUse[];
  /** Whole teams only: a team whose final heroes do not match its scoreboard is left out. */
  hero_timelines: HeroTimeline[];
}

/** The live game feed's timer slots, plus the ultimate. The table's check constraint holds the same list. */
export const ABILITY_SLOTS = [
  'ability_0',
  'ability_1',
  'ability_2',
  'ability_3',
  'ability_4',
  'team_up_0',
  'team_up_1',
  'ultimate',
] as const;
export type AbilitySlot = (typeof ABILITY_SLOTS)[number];

/** A player swaps hero a handful of times in a match; more than this is not a real list. */
export const MAX_HERO_FIGURES = 20;
/** A 6v6 lobby has at most 6 x 6 hero pairs fighting, and a hero can fight its own kind. */
export const MAX_HERO_KILL_PAIRS = 150;
export const MAX_KILLS_PER_PAIR = 999;
/** Every hero a list can hold, in every slot. */
export const MAX_ABILITY_USES = MAX_HERO_FIGURES * ABILITY_SLOTS.length;
export const MAX_ABILITY_COUNT = 999;
/** A 6v6 lobby has 12 players; a longer list is not a real one. */
export const MAX_TIMELINE_PLAYERS = 12;
/** The overlay keeps up to 20 heroes per player. */
export const MAX_TIMELINE_PICKS = 20;
const MAX_INT4 = 2_147_483_647;
/** Longest match a custom lobby can run, in seconds. */
const MAX_SEGMENT_SECONDS = 7_200;
/** Far above any real match (the heaviest is about 150,000); it stops an absurd value from skewing a sum. */
const MAX_FIGURE = 1_000_000;
const HERO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG_LENGTH = 40;

/**
 * `participants` are the match's scoreboard lines, which decide whether a team's timelines can be
 * trusted; without them no timeline is kept.
 */
export function readExtendedUpload(match: JsonRecord, participants: readonly ParticipantRow[] = []): ExtendedUpload | null {
  const local = asRecord(match['match_player']);
  const recorderUid = readUid(local?.['player_uid']);
  // Without a uid the figures cannot be tied to the recorder's line, so they are not kept.
  const heroFigures = recorderUid === null ? [] : readHeroFigures(local?.['hero_segments']);
  const heroKills = readHeroKills(match['hero_kills']);
  const heroAbilityUses = recorderUid === null ? [] : readHeroAbilityUses(local?.['hero_ability_uses']);

  const heroTimelines = readHeroTimelines(match['hero_timelines'], participants);

  if (heroFigures.length === 0 && heroKills.length === 0 && heroAbilityUses.length === 0 && heroTimelines.length === 0) return null;
  return {
    recorder_uid: recorderUid,
    hero_figures: heroFigures,
    hero_kills: heroKills,
    hero_ability_uses: heroAbilityUses,
    hero_timelines: heroTimelines,
  };
}

function readHeroTimelines(value: unknown, participants: readonly ParticipantRow[]): HeroTimeline[] {
  // A list longer than a lobby, or a picks list longer than the overlay keeps, is not a real one.
  if (!Array.isArray(value) || value.length > MAX_TIMELINE_PLAYERS) return [];

  const timelines: HeroTimeline[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    const picks = record === null ? null : readHeroPicks(record['picks']);
    if (picks === 'oversized') return [];
    const team = readTeam(record?.['team']);
    if (picks === null || team === null) continue;
    timelines.push({ team, picks });
  }

  // A player whose timeline was dropped leaves their team short, so that team fails the check below.
  return timelines.filter(timeline => teamMatchesScoreboard(timeline.team, timelines, participants));
}

/** Null for a list that is not a usable timeline; 'oversized' for one no real player could have. */
function readHeroPicks(value: unknown): HeroPick[] | 'oversized' | null {
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_TIMELINE_PICKS) return 'oversized';
  if (value.length === 0) return null;

  const picks: HeroPick[] = [];
  for (const entry of value) {
    const pick = asRecord(entry);
    const heroId = readId(pick?.['hero_id']);
    const atSecond = readWhole(pick?.['at_second'], MAX_SEGMENT_SECONDS);
    // Time only moves forward, so a list that goes back was not recorded in order.
    if (heroId === null || atSecond === null || atSecond < (picks.at(-1)?.at_second ?? 0)) return null;
    picks.push({ hero_id: heroId, at_second: atSecond });
  }
  return picks;
}

/** A team's last picks must be the heroes its scoreboard lines show, or the timelines are not about this match. */
function teamMatchesScoreboard(team: number, timelines: readonly HeroTimeline[], participants: readonly ParticipantRow[]): boolean {
  const finalHeroes = timelines.filter(timeline => timeline.team === team).map(timeline => timeline.picks.at(-1)!.hero_id);
  const scoreboardHeroes = participants.filter(row => row.team === team).map(row => row.hero_id);
  if (finalHeroes.length !== scoreboardHeroes.length) return false;

  const sortedScoreboard = scoreboardHeroes.sort((a, b) => (a ?? -1) - (b ?? -1));
  return finalHeroes.sort((a, b) => a - b).every((heroId, index) => heroId === sortedScoreboard[index]);
}

function readHeroAbilityUses(value: unknown): HeroAbilityUse[] {
  // A list longer than every slot of every hero is not a real one, so none of it is trusted.
  if (!Array.isArray(value) || value.length > MAX_ABILITY_USES) return [];

  const uses = new Map<string, HeroAbilityUse>();
  for (const entry of value) {
    const record = asRecord(entry);
    const heroId = readId(record?.['hero_id']);
    const slot = readSlot(record?.['slot']);
    const count = readCount(record?.['uses']);
    if (record === null || heroId === null || slot === null || count === null) continue;

    const key = `${heroId} ${slot}`;
    if (uses.has(key)) continue;
    uses.set(key, {
      hero_id: heroId,
      slot,
      uses: count,
      kills_after: readCount(record['kills_after']),
      assists_after: readCount(record['assists_after']),
    });
  }
  return [...uses.values()];
}

function readSlot(value: unknown): AbilitySlot | null {
  return ABILITY_SLOTS.find(slot => slot === value) ?? null;
}

/** A use count is counted, not measured: a fraction is a bad value, not a number to round. */
function readCount(value: unknown): number | null {
  const count = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof count === 'number' && Number.isInteger(count) && count >= 0 && count <= MAX_ABILITY_COUNT ? count : null;
}

function readHeroFigures(value: unknown): HeroFigure[] {
  if (!Array.isArray(value)) return [];

  const figures = new Map<number, HeroFigure>();
  for (const entry of value) {
    const segment = asRecord(entry);
    const heroId = readId(segment?.['hero_id']);
    if (segment === null || heroId === null || figures.has(heroId)) continue;

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

/** A game hero id is a label, not a measurement: a fraction is a bad value, not a number to round. */
function readId(value: unknown): number | null {
  const id = typeof value === 'string' && value.trim() ? Number(value) : value;
  return typeof id === 'number' && Number.isInteger(id) && id >= 1 && id <= MAX_INT4 ? id : null;
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
