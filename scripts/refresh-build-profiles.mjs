import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildHeroBuildProfile, buildProfileRationale } from './hero-build-profile-utils.mjs';
import { listHeroes, saveHero } from '../src/hero-store.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const heroesPath = join(projectRoot, 'data', 'seeds', 'heroes.mock.json');

const mockHeroes = JSON.parse(readFileSync(heroesPath, 'utf8'));
const refreshedMockHeroes = mockHeroes.map(refreshHeroProfile);

writeFileSync(heroesPath, `${JSON.stringify(refreshedMockHeroes, null, 2)}\n`);
console.log(`Refreshed build profiles in heroes.mock.json for ${refreshedMockHeroes.length} heroes.`);

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('Skipped database update because SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.');
  process.exit(0);
}

const db = getSupabaseClient();
const heroes = await listHeroes(db);

for (const hero of heroes) {
  await saveHero(db, refreshHeroProfile(hero));
}

console.log(`Refreshed build profiles in Supabase for ${heroes.length} heroes.`);

function refreshHeroProfile(hero) {
  const buildProfile = buildHeroBuildProfile(hero);

  return {
    ...hero,
    buildProfile,
    buildProfileRationale: buildProfileRationale(hero, buildProfile),
  };
}
