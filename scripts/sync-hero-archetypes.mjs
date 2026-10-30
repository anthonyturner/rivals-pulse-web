import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import { HERO_GAMEPLAY_ARCHETYPES } from '../src/app/features/heroes/hero-gameplay-archetypes.ts';
import { listHeroes, saveHero } from '../src/hero-store.ts';
import { finishSyncRun, saveExternalSource, startSyncRun } from '../src/sync-log.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const transcriptPath = join(projectRoot, 'docs', 'guides', 'winrates-s9.txt');
const sourceKey = 'nerfpool-s9-week1';
const sourceName = "Nerfpool: Every Hero's Win Rate (Season 9, Week 1)";
const sourceUrl = 'https://www.youtube.com/watch?v=VB6OIA-ChmA';
const transcript = readFileSync(transcriptPath, 'utf8');
const reportData = await loadSeasonReportData();
const db = getSupabaseClient();
const runId = await startSyncRun(db, 'hero-gameplay-archetypes', 'Syncing Season 9 gameplay archetypes into hero records.');

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

    const updatedHero = {
      ...hero,
      gameplayArchetypes,
      season9WinRateInsights: reportData.SEASON_9_HERO_INSIGHTS.filter(
        (insight) => insight.heroId === heroId,
      ),
    };

    await saveHero(db, updatedHero);
    updatedHeroIds.push(heroId);
  }

  const unmatchedDatabaseHeroIds = heroes
    .map((hero) => hero.id)
    .filter((heroId) => !HERO_GAMEPLAY_ARCHETYPES[heroId]);
  const sourcePayload = {
    videoId: 'VB6OIA-ChmA',
    title: sourceName,
    sourceUrl,
    season: 9,
    week: 1,
    transcript,
    gameplayArchetypes: HERO_GAMEPLAY_ARCHETYPES,
    heroInsights: reportData.SEASON_9_HERO_INSIGHTS,
    metaQuadrants: reportData.SEASON_9_META_QUADRANTS,
    roleLadder: reportData.SEASON_9_ROLE_LADDER,
    oneTricks: reportData.SEASON_9_ONE_TRICKS,
    updatedHeroIds,
    missingDatabaseHeroIds,
    unmatchedDatabaseHeroIds,
  };
  const message = [
    `Updated ${updatedHeroIds.length} hero records.`,
    missingDatabaseHeroIds.length
      ? `Missing database heroes: ${missingDatabaseHeroIds.join(', ')}.`
      : 'All archetype heroes were present.',
    unmatchedDatabaseHeroIds.length
      ? `Database heroes without archetypes: ${unmatchedDatabaseHeroIds.join(', ')}.`
      : 'All database heroes have archetypes.',
  ].join(' ');

  await upsertExternalSource(sourcePayload, 'success', null);
  await finishSyncRun(db, runId, {
    status: 'success',
    message,
    details: { updatedHeroIds, missingDatabaseHeroIds, unmatchedDatabaseHeroIds },
  });

  console.log(message);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  await upsertExternalSource({}, 'error', message);
  await finishSyncRun(db, runId, { status: 'error', message });
  throw error;
}

function upsertExternalSource(payload, status, error) {
  return saveExternalSource(db, {
    sourceKey,
    sourceName,
    url: sourceUrl,
    payload,
    fetchedAt: new Date().toISOString(),
    status,
    error,
  });
}

async function loadSeasonReportData() {
  const reportDataPath = join(
    projectRoot,
    'src',
    'app',
    'season-9-win-rates',
    'season-9-win-rates.data.ts',
  );
  const bundle = await build({
    entryPoints: [reportDataPath],
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    write: false,
  });
  const source = bundle.outputFiles[0]?.text;

  if (!source) {
    throw new Error('Could not bundle the Season 9 report data for database synchronization.');
  }

  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
