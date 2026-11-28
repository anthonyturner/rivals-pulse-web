import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { mapArtPath } from '../src/app/shared/utilities/map-art.ts';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const mapImages = join(projectRoot, 'public', 'images', 'maps');
const seedMaps = JSON.parse(readFileSync(join(projectRoot, 'data', 'pulse-atlas', 'seed-maps.json'), 'utf8'));

// Not in the overlay's map catalog, so the app has no picture of them to ship.
const MAPS_WITHOUT_ART = new Set(['Digital Duel Grounds', 'Jeffland', 'World Arena']);

test('every map the site knows by name has a picture that exists', () => {
  const names = [...new Set(seedMaps.map((map) => map.name))].filter((name) => !MAPS_WITHOUT_ART.has(name));

  assert.ok(names.length > 0);
  for (const name of names) {
    const path = mapArtPath(name);

    assert.ok(path, `${name} has no picture`);
    assert.ok(existsSync(join(projectRoot, 'public', path)), `${path} for ${name} is not in public/`);
  }
});

test('no picture in public/images/maps is left without a map that uses it', () => {
  const used = new Set(seedMaps.map((map) => mapArtPath(map.name)).filter(Boolean));
  const stray = readdirSync(mapImages).filter((file) => !used.has(`/images/maps/${file}`));

  assert.deepEqual(stray, []);
});
