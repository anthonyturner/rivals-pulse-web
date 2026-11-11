import seedMaps from '../../../../data/pulse-atlas/seed-maps.json' with { type: 'json' };

/**
 * Maps in the Pulse Atlas list that never reach the Quick Match and Competitive rate the Maps tab
 * shows, so they must not be named as still waiting for one.
 *
 * - Sanctum Sanctorum, Grand Garden and Ninomaru: marked `"kind": "arcade"` in the overlay's
 *   `src/app/data/map-catalog.json`.
 * - Digital Duel Grounds, World Arena and Jeffland: not in that catalog at all, and on 2026-11-11
 *   production's per-map counts held no match on them in any mode, while every map that does
 *   appear in Quick Match or Competitive has 20 or more. If one ever gets matches, it shows on its
 *   own: the tab names any map with a result, known or not.
 */
const MAPS_WITHOUT_A_RATE: ReadonlySet<string> = new Set([
  'Sanctum Sanctorum',
  'Grand Garden',
  'Ninomaru',
  'Digital Duel Grounds',
  'World Arena',
  'Jeffland',
]);

/**
 * The maps the site knows by name, once each: the Pulse Atlas map list has one entry per game map id,
 * and several ids (the Royal Palace layouts) share a name. The Maps tab names the ones with no figure
 * yet from this list, so a visitor can see which maps are still waiting for matches.
 */
export const KNOWN_MAP_NAMES: readonly string[] = [
  ...new Set(seedMaps.map((map) => map.name).filter((name) => !MAPS_WITHOUT_A_RATE.has(name))),
].sort((a, b) => a.localeCompare(b));
