// Compares public.hero_game_roles with the live hero list (hero_content) and hero-game-ids.json, and
// exits 1 listing every difference. It only reads. Run it after the hero roster sync, or after a
// migration that changes the table:  npm run check:hero-game-roles
import { heroGameIdEntries, listHeroRoles } from '../src/server/heroes/catalog/index.ts';
import { compareHeroGameRoles } from './hero-game-roles-compare.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const db = getSupabaseClient();
const { data, error } = await db.from('hero_game_roles').select('game_id, base_game_id, role');

if (error) {
  throw new Error(`Reading hero_game_roles failed: ${error.message}`);
}

const problems = compareHeroGameRoles(
  (data ?? []).map((row) => ({ gameId: row.game_id, baseGameId: row.base_game_id, role: row.role })),
  heroGameIdEntries,
  await listHeroRoles(db),
);

if (problems.length > 0) {
  console.error(`hero_game_roles is out of step with the live hero list (${problems.length}):`);
  problems.forEach((problem) => console.error(`  ${problem}`));
  console.error('Fix it with a new migration that upserts the rows, or add the hero to data/pulse-atlas/hero-game-ids.json.');
  process.exitCode = 1;
} else {
  console.log(`hero_game_roles matches the live hero list (${data?.length ?? 0} rows).`);
}
