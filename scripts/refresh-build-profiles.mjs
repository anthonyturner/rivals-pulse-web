import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildHeroBuildProfile, buildProfileRationale } from './hero-build-profile-utils.mjs';
import { createTursoClient } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const heroesPath = join(projectRoot, 'data', 'seeds', 'heroes.mock.json');

const mockHeroes = JSON.parse(readFileSync(heroesPath, 'utf8'));
const refreshedMockHeroes = mockHeroes.map(refreshHeroProfile);

writeFileSync(heroesPath, `${JSON.stringify(refreshedMockHeroes, null, 2)}\n`);
console.log(`Refreshed build profiles in heroes.mock.json for ${refreshedMockHeroes.length} heroes.`);

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.log('Skipped database update because TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is not configured.');
  process.exit(0);
}

const db = createTursoClient();

try {
  const result = await db.execute('SELECT id, raw_json FROM heroes ORDER BY name COLLATE NOCASE');
  let updatedCount = 0;

  for (const row of result.rows) {
    const hero = refreshHeroProfile(JSON.parse(row.raw_json));

    await db.execute(
      `UPDATE heroes
      SET raw_json = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [JSON.stringify(hero), row.id],
    );
    updatedCount += 1;
  }

  console.log(`Refreshed build profiles in Turso for ${updatedCount} heroes.`);
} finally {
  db.close();
}

function refreshHeroProfile(hero) {
  const buildProfile = buildHeroBuildProfile(hero);

  return {
    ...hero,
    buildProfile,
    buildProfileRationale: buildProfileRationale(hero, buildProfile),
  };
}
