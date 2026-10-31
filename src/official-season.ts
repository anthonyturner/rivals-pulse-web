import { StringUtility } from './app/shared/utilities/string-utility.js';

export interface OfficialSeason {
  currentSeason: string;
  seasonStory?: string;
}

/**
 * Reads the live season from the official news headlines.
 *
 * The season is announced in more than one shape: "Season 10: Butcher's
 * Blasphemy // Dev Vision Vol. 21" carries the story name, while
 * "Version 20260911 Patch Notes - Season 10 Arrives" carries only the number.
 * Every headline is scanned and the highest season number wins, so a headline
 * left over from the previous season cannot hold the site back a season.
 */
export function parseCurrentSeason(titles: readonly string[]): OfficialSeason | undefined {
  const seasonPattern = /Season\s+(\d+)(?:\.\d+)?\s*(?::\s*([^/|]+))?/gi;
  let best: { number: number; seasonStory?: string } | undefined;

  for (const title of titles) {
    for (const match of title.matchAll(seasonPattern)) {
      const seasonNumber = Number.parseInt(match[1], 10);

      if (!Number.isFinite(seasonNumber)) {
        continue;
      }

      const seasonStory = normalizeSeasonStory(match[2]);

      if (!best || seasonNumber > best.number) {
        best = { number: seasonNumber, seasonStory };
        continue;
      }

      // A mid-season patch headline names the season without its story, so the
      // story is kept from whichever headline of the same season does name it.
      if (seasonNumber === best.number && seasonStory && !best.seasonStory) {
        best.seasonStory = seasonStory;
      }
    }
  }

  return best && { currentSeason: `Season ${best.number}`, seasonStory: best.seasonStory };
}

function normalizeSeasonStory(value: string | undefined): string | undefined {
  const story = StringUtility.cleanText(value ?? '')
    .replace(/\s*\|.*$/u, '')
    .replace(/[\s.\-–—]+$/u, '')
    .trim();

  return story || undefined;
}
