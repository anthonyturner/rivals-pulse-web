/**
 * The in-game art for each map, as the desktop app (anthonyturner/rivals_pulse) bundles it. `names` are the
 * spellings that app's `map-catalog.json` lists for the map, plus the short names `data/pulse-atlas/seed-maps.json`
 * uses, which are what the community answers carry. The pictures in `public/images/maps/` are those images
 * cropped to 16:9 and resized to 320 pixels wide.
 */
interface MapArt {
  image: string;
  names: readonly string[];
}

const MAP_ART: readonly MapArt[] = [
  { image: 'empire-of-eternal-night-central-park', names: ['Central Park', 'Empire of Eternal Night: Central Park'] },
  { image: 'empire-of-eternal-night-midtown', names: ['Midtown', 'Empire of Eternal Night: Midtown'] },
  {
    image: 'empire-of-eternal-night-sanctum-sanctorum',
    names: ['Sanctum Sanctorum', 'Empire of Eternal Night: Sanctum Sanctorum'],
  },
  { image: 'grand-garden', names: ['Grand Garden'] },
  { image: 'hall-of-djalia', names: ['Hall of Djalia', 'Hall of djaalia'] },
  { image: 'hellfire-gala-arakko', names: ['Arakko', 'Hellfire Gala: Arakko'] },
  { image: 'hellfire-gala-krakoa', names: ['Krakoa', 'Hellfire Gala: Krakoa'] },
  { image: 'hydra-charteris-base-hells-heaven', names: ["Hell's Heaven", "Hydra Charteris Base: Hell's Heaven"] },
  {
    image: 'intergalactic-empire-of-wakanda-birnin-tchalla',
    names: ["Birnin T'Challa", "Intergalactic Empire of Wakanda: Birnin T'Challa"],
  },
  {
    image: 'klyntar-awakens-celestial-husk',
    names: ['Celestial Husk', 'Klyntar Awakens: Celestial Husk', 'Klyntar: Celestial Husk'],
  },
  {
    image: 'klyntar-symbiotic-surface',
    names: ['Symbiotic Surface', 'Klyntar: Symbiotic Surface', 'Klyntar Awakens: Symbiotic Surface'],
  },
  {
    image: 'klyntar-throne-of-knull',
    names: ['Throne of Knull', 'Klyntar: Throne of Knull', 'Klyntar Awakens: Throne of Knull'],
  },
  { image: 'kun-lun-heart-of-heaven', names: ['Heart of Heaven', 'Kun-Lun: Heart of Heaven'] },
  { image: 'lower-manhattan', names: ['Lower Manhattan'] },
  { image: 'museum-of-contemplation', names: ['Museum of Contemplation'] },
  { image: 'ninomaru', names: ['Ninomaru'] },
  { image: 'times-square', names: ['Times Square'] },
  { image: 'tokyo-2099-shin-shibuya', names: ['Shin-Shibuya', 'Tokyo 2099: Shin-Shibuya'] },
  { image: 'tokyo-2099-spider-islands', names: ['Spider-Islands', 'Tokyo 2099: Spider-Islands'] },
  {
    image: 'yggsgard-yggdrasill-path-and-royal-palace',
    names: [
      'Yggdrasill Path',
      'Royal Palace',
      'Yggsgard',
      'Yggsgard: Yggdrasill Path',
      'Yggsgard: Royal Palace',
      'Yggsgard: Yggdrasill Path and Royal Palace',
    ],
  },
];

/** Case, spacing and apostrophe style never decide a match: the database spells "Birnin t'challa" in lower case. */
function nameKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const IMAGE_BY_NAME: ReadonlyMap<string, string> = new Map(
  MAP_ART.flatMap(({ image, names }) => names.map((name): [string, string] => [nameKey(name), `/images/maps/${image}.webp`])),
);

/** The picture of a map, or null for a map the site has no art for. */
export function mapArtPath(mapName: string): string | null {
  return IMAGE_BY_NAME.get(nameKey(mapName)) ?? null;
}

/** One or two capitals that stand in for a map with no art, such as "CP" for "Central Park". */
export function mapInitials(mapName: string): string {
  return mapName
    .split(/[^A-Za-z0-9]+/)
    .filter((word) => word.length > 0 && word.toLowerCase() !== 'of')
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}
