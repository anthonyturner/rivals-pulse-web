import {
  STRATEGIST_TAGS,
  type StrategistTag,
  type StrategistTagEntry,
} from '../../../contracts/strategist-tags.model.ts';
import curatedStrategistTags from '../../../../data/pulse-atlas/strategist-tags.json' with { type: 'json' };
import { heroGameIdEntries, type HeroGameIdEntry } from './hero-game-ids.ts';

/**
 * Reads the curated list, refusing a tag the code does not know. The committed file is checked by
 * Pulse Atlas and by a spec, so a refusal here means the file was changed without either.
 */
export function parseStrategistTags(entries: readonly { heroId: string; tag: string }[]): StrategistTagEntry[] {
  return entries.map((entry) => {
    const tag = STRATEGIST_TAGS.find((known) => known === entry.tag);

    if (tag === undefined) {
      throw new Error(`strategist-tags.json: ${entry.heroId} has tag ${entry.tag}`);
    }

    return { heroId: entry.heroId, tag };
  });
}

/**
 * Base game id to the hero's tag, for the heroes that have one. Deadpool's entry is under his base
 * id 1057, which is what a trio stores for his Strategist form (10573); his other forms are never
 * Strategists, so the entry cannot be reached from them.
 */
export function buildStrategistTagByGameId(
  tags: readonly StrategistTagEntry[],
  gameIds: readonly HeroGameIdEntry[],
): ReadonlyMap<number, StrategistTag> {
  const gameIdBySlug = new Map(gameIds.map((entry) => [entry.id, entry.gameId]));

  return new Map(
    tags.flatMap((entry): [number, StrategistTag][] => {
      const gameId = gameIdBySlug.get(entry.heroId);

      return gameId === undefined ? [] : [[gameId, entry.tag]];
    }),
  );
}

export const strategistTagEntries: readonly StrategistTagEntry[] = parseStrategistTags(curatedStrategistTags);

export const strategistTagByGameId: ReadonlyMap<number, StrategistTag> = buildStrategistTagByGameId(
  strategistTagEntries,
  heroGameIdEntries,
);
