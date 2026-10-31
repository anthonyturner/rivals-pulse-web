import { HERO_GAMEPLAY_ARCHETYPES } from '../src/app/features/heroes/hero-gameplay-archetypes.ts';
import { listHeroes, saveHero } from '../src/hero-store.ts';
import { finishSyncRun, startSyncRun } from '../src/sync-log.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const db = getSupabaseClient();
const runId = await startSyncRun(db, 'hero-gameplay-archetypes', 'Syncing gameplay archetypes into hero records.');

try {
  const heroes = await listHeroes(db);
  const updatedHeroIds = [];
  const missingDatabaseHeroIds = [];

  for (const [heroId, gameplayArchetypes] of Object.entries(HERO_GAMEPLAY_ARCHETYPES)) {
    const hero = heroes.find((candidate) => candidate.id === heroId);

    if (!hero) {
      missingDatabaseHeroIds.push(heroId);
      continue;
    }

    // Older records carry the retired Season 9 win-rate insights; saving without them clears them.
    const { season9WinRateInsights: _retired, ...current } = hero;

    await saveHero(db, { ...current, gameplayArchetypes });
    updatedHeroIds.push(heroId);
  }

  const unmatchedDatabaseHeroIds = heroes
    .map((hero) => hero.id)
    .filter((heroId) => !HERO_GAMEPLAY_ARCHETYPES[heroId]);
  const message = [
    `Updated ${updatedHeroIds.length} hero records.`,
    missingDatabaseHeroIds.length
      ? `Missing database heroes: ${missingDatabaseHeroIds.join(', ')}.`
      : 'All archetype heroes were present.',
    unmatchedDatabaseHeroIds.length
      ? `Database heroes without archetypes: ${unmatchedDatabaseHeroIds.join(', ')}.`
      : 'All database heroes have archetypes.',
  ].join(' ');

  await finishSyncRun(db, runId, {
    status: 'success',
    message,
    details: { updatedHeroIds, missingDatabaseHeroIds, unmatchedDatabaseHeroIds },
  });

  console.log(message);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  await finishSyncRun(db, runId, { status: 'error', message });
  throw error;
}
