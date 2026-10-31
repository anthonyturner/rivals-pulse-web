import { buildHeroPlaystyle } from './playstyle-utils.mjs';
import { listHeroes, saveHero } from '../src/hero-store.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const db = getSupabaseClient();
const heroes = await listHeroes(db);
let updated = 0;

for (const hero of heroes) {
  const nextPlaystyle = buildHeroPlaystyle(hero);

  if (nextPlaystyle === hero.playstyle) {
    continue;
  }

  const nextHero = {
    ...hero,
    playstyle: nextPlaystyle,
  };

  await saveHero(db, nextHero);
  updated += 1;
}

console.log(`Refreshed playstyles for ${updated} heroes.`);
