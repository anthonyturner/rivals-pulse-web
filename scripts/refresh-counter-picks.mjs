import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const heroesPath = join(__dirname, '..', 'data', 'seeds', 'heroes.mock.json');

// Counter picks derived from rivalsmeta.com Season 9 matchup win rates
// (Diamond+ ranks, fetched 2026-08-03; see data/verification/counter-verification-2026-08-03.md).
// Each losing matchup is scored as (win-rate deficit) - (opponent overall WR - 50)/2 so
// genuinely lopsided matchups rank above heroes that are merely strong overall, then the
// top five are kept. Lists are shorter where a hero has fewer losing matchups: Mantis only
// loses to Peni Parker, and Peni Parker loses to no one at high ranks (her list holds the
// least-unfavorable picks against her).
const counterPicksByHero = {
  'Adam Warlock': ['Peni Parker', 'Black Cat', 'Daredevil', 'Magik', 'Human Torch'],
  Angela: ['Peni Parker', 'Human Torch', 'Iron Man', 'Groot', 'Storm'],
  'Black Cat': ['Peni Parker', 'Human Torch', 'Mantis', 'Groot', 'Magik'],
  'Black Panther': ['Mantis', 'Peni Parker', 'Groot', 'Black Cat', 'Daredevil'],
  'Black Widow': ['Peni Parker', 'Storm', 'Iron Man', 'Human Torch', 'Mantis'],
  Blade: ['Peni Parker', 'Magik', 'Daredevil', 'Mantis', 'Hulk'],
  Hulk: ['Peni Parker', 'Mantis', 'Daredevil', 'Groot', 'Human Torch'],
  'Captain America': ['Peni Parker', 'Groot', 'Hawkeye', 'Mantis', 'Storm'],
  'Cloak & Dagger': ['Peni Parker', 'Mantis', 'Black Cat', 'Storm', 'Magik'],
  Cyclops: ['Peni Parker', 'Storm', 'Human Torch', 'Iron Man', 'The Thing'],
  Daredevil: ['Peni Parker', 'Mantis', 'Black Cat', 'Magik'],
  Deadpool: ['Peni Parker', 'Black Cat', 'Daredevil', 'Magik', 'Storm'],
  'Devil Dinosaur': ['Peni Parker', 'Magik', 'Daredevil', 'Black Cat', 'Mantis'],
  'Doctor Strange': ['Peni Parker', 'Storm', 'Human Torch', 'Mantis', 'Black Cat'],
  'Elsa Bloodstone': ['Peni Parker', 'Black Cat', 'Daredevil', 'Mantis', 'Storm'],
  'Emma Frost': ['Peni Parker', 'Daredevil', 'Black Cat', 'Magik', 'Human Torch'],
  Gambit: ['Peni Parker', 'Mantis', 'Storm', 'Iron Man', 'Magik'],
  Groot: ['Peni Parker', 'Magik', 'The Thing', 'Daredevil', 'Storm'],
  Hawkeye: ['Peni Parker', 'Storm', 'Mantis', 'Ultron', 'Mister Fantastic'],
  Hela: ['Peni Parker', 'Human Torch', 'Iron Man', 'Storm', 'Mantis'],
  'Human Torch': ['Peni Parker', 'Black Panther', 'Daredevil', 'Magik', 'Mantis'],
  'Invisible Woman': ['Peni Parker', 'Black Cat', 'Mantis', 'Storm', 'Daredevil'],
  'Iron Fist': ['Peni Parker', 'Daredevil', 'Angela', 'Iron Man', 'Storm'],
  'Iron Man': ['Peni Parker', 'Daredevil', 'Black Cat', 'Black Panther', 'Mantis'],
  'Jeff the Land Shark': ['Peni Parker', 'Daredevil', 'Mantis', 'Storm', 'Groot'],
  Jubilee: ['Peni Parker', 'Mantis', 'Storm', 'Human Torch', 'Magik'],
  Loki: ['Peni Parker', 'Storm', 'Black Cat', 'Magik', 'Human Torch'],
  'Luna Snow': ['Peni Parker', 'Storm', 'Mantis', 'Groot', 'Iron Man'],
  Magik: ['Peni Parker', 'Mantis', 'Daredevil'],
  Magneto: ['Peni Parker', 'Mantis', 'Storm', 'Iron Man', 'Groot'],
  Mantis: ['Peni Parker'],
  'Mister Fantastic': ['Black Cat', 'Peni Parker', 'Daredevil', 'Black Panther', 'Magik'],
  'Moon Knight': ['Peni Parker', 'Loki', 'Mantis', 'Mister Fantastic', 'Groot'],
  Namor: ['Daredevil', 'Peni Parker', 'Black Cat', 'Magik', 'Black Panther'],
  'Peni Parker': ['Daredevil', 'Black Panther', 'Black Cat'],
  Phoenix: ['Peni Parker', 'Storm', 'Iron Man', 'Human Torch', 'Mantis'],
  Psylocke: ['Peni Parker', 'Black Cat', 'Mantis', 'Magik', 'Groot'],
  'Rocket Raccoon': ['Peni Parker', 'Daredevil', 'Mantis', 'Magik', 'Storm'],
  Rogue: ['Peni Parker', 'Storm', 'Mantis', 'Black Cat', 'Magik'],
  'Scarlet Witch': ['Black Panther', 'Storm', 'Daredevil', 'Peni Parker', 'Human Torch'],
  'Spider-Man': ['Peni Parker', 'Iron Man', 'Storm', 'Human Torch', 'Mantis'],
  'Squirrel Girl': ['Peni Parker', 'Groot', 'Mantis', 'Hawkeye', 'Daredevil'],
  'Star-Lord': ['Peni Parker', 'Iron Man', 'Storm', 'Daredevil', 'The Thing'],
  Storm: ['Peni Parker', 'Black Cat', 'Daredevil', 'Magik', 'Mantis'],
  'The Punisher': ['Peni Parker', 'Groot', 'Devil Dinosaur', 'Iron Man', 'Human Torch'],
  'The Thing': ['Black Cat', 'Black Panther', 'Peni Parker', 'Daredevil', 'Magik'],
  Thor: ['Peni Parker', 'Black Cat', 'Daredevil', 'Magik', 'Mantis'],
  Ultron: ['Peni Parker', 'Black Panther', 'Daredevil', 'Storm', 'Human Torch'],
  Venom: ['Peni Parker', 'Groot', 'Mantis', 'Daredevil', 'Black Cat'],
  'White Fox': ['Peni Parker', 'Mantis', 'Black Cat', 'Daredevil', 'Magik'],
  'Winter Soldier': ['Peni Parker', 'Daredevil', 'Black Cat', 'Mantis', 'Magik'],
  Wolverine: ['Peni Parker', 'Venom', 'Groot', 'Hulk', 'Loki'],
};

const heroes = JSON.parse(readFileSync(heroesPath, 'utf8'));
const heroNames = new Set(heroes.map((hero) => hero.name));
const missingHeroes = heroes
  .map((hero) => hero.name)
  .filter((name) => !counterPicksByHero[name]);
const invalidCounters = Object.entries(counterPicksByHero)
  .flatMap(([heroName, counters]) =>
    counters
      .filter((counter) => !heroNames.has(counter))
      .map((counter) => `${heroName} -> ${counter}`),
  );

if (missingHeroes.length > 0 || invalidCounters.length > 0) {
  throw new Error([
    missingHeroes.length ? `Missing counter maps: ${missingHeroes.join(', ')}` : '',
    invalidCounters.length ? `Invalid counter names: ${invalidCounters.join(', ')}` : '',
  ].filter(Boolean).join('\n'));
}

const updatedHeroes = heroes.map((hero) => ({
  ...hero,
  counters: counterPicksByHero[hero.name],
}));

writeFileSync(heroesPath, `${JSON.stringify(updatedHeroes, null, 2)}\n`);

const db = createTursoClient();
const updatedAt = new Date().toISOString();

for (const hero of updatedHeroes) {
  await db.execute('UPDATE heroes SET raw_json = ?, updated_at = ? WHERE id = ?', [
    JSON.stringify(hero),
    updatedAt,
    hero.id,
  ]);
  await db.execute('DELETE FROM hero_list_items WHERE hero_id = ? AND item_type = ?', [
    hero.id,
    'counter',
  ]);

  for (const [index, counter] of hero.counters.entries()) {
    await db.execute(
      `INSERT INTO hero_list_items (hero_id, item_type, value, sort_order)
      VALUES (?, ?, ?, ?)`,
      [hero.id, 'counter', counter, index],
    );
  }
}

db.close();

console.log(`Updated counter picks for ${updatedHeroes.length} heroes.`);

// Heroes that exist in the live database but not yet in the mock seed
// (e.g. roster additions from sync-official-heroes) still get counter data.
const dbOnlyHeroNames = Object.keys(counterPicksByHero).filter((name) => !heroNames.has(name));

if (dbOnlyHeroNames.length > 0) {
  const dbExtra = createTursoClient();

  for (const name of dbOnlyHeroNames) {
    const result = await dbExtra.execute(
      "SELECT id, raw_json FROM heroes WHERE json_extract(raw_json, '$.name') = ?",
      [name],
    );
    const row = result.rows[0];

    if (!row) {
      console.warn(`Skipped ${name}: not present in the database.`);
      continue;
    }

    const rawHero = JSON.parse(row.raw_json);
    rawHero.counters = counterPicksByHero[name];

    await dbExtra.execute('UPDATE heroes SET raw_json = ?, updated_at = ? WHERE id = ?', [
      JSON.stringify(rawHero),
      updatedAt,
      row.id,
    ]);
    await dbExtra.execute('DELETE FROM hero_list_items WHERE hero_id = ? AND item_type = ?', [
      row.id,
      'counter',
    ]);

    for (const [index, counter] of counterPicksByHero[name].entries()) {
      await dbExtra.execute(
        `INSERT INTO hero_list_items (hero_id, item_type, value, sort_order)
        VALUES (?, ?, ?, ?)`,
        [row.id, 'counter', counter, index],
      );
    }

    console.log(`Updated counter picks for database-only hero ${name}.`);
  }

  dbExtra.close();
}
