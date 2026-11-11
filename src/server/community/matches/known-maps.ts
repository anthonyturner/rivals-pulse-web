import seedMaps from '../../../../data/pulse-atlas/seed-maps.json' with { type: 'json' };

/**
 * The maps the site knows by name, once each: the Pulse Atlas map list has one entry per game map id,
 * and several ids (the Royal Palace layouts) share a name. The Maps tab names the ones with no figure
 * yet from this list, so a visitor can see which maps are still waiting for matches.
 */
export const KNOWN_MAP_NAMES: readonly string[] = [...new Set(seedMaps.map((map) => map.name))].sort((a, b) =>
  a.localeCompare(b),
);
