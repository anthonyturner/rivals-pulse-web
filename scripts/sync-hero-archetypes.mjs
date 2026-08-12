import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

import { HERO_GAMEPLAY_ARCHETYPES } from '../src/app/features/heroes/hero-gameplay-archetypes.ts';
import { createTursoClient } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const transcriptPath = join(projectRoot, 'docs', 'guides', 'winrates-s9.txt');
const sourceKey = 'nerfpool-s9-week1';
const sourceName = "Nerfpool: Every Hero's Win Rate (Season 9, Week 1)";
const sourceUrl = 'https://www.youtube.com/watch?v=VB6OIA-ChmA';
const startedAt = new Date().toISOString();
const transcript = readFileSync(transcriptPath, 'utf8');
const reportData = await loadSeasonReportData();
const db = createTursoClient();
const runId = await insertSyncRun('hero-gameplay-archetypes', startedAt);

try {
  const result = await db.execute('SELECT id, raw_json FROM heroes ORDER BY id');
  const updatedHeroIds = [];
  const missingDatabaseHeroIds = [];

  for (const [heroId, gameplayArchetypes] of Object.entries(HERO_GAMEPLAY_ARCHETYPES)) {
    const row = result.rows.find((candidate) => candidate.id === heroId);

    if (!row) {
      missingDatabaseHeroIds.push(heroId);
      continue;
    }

    const hero = JSON.parse(String(row.raw_json));
    const updatedHero = {
      ...hero,
      gameplayArchetypes,
      season9WinRateInsights: reportData.SEASON_9_HERO_INSIGHTS.filter(
        (insight) => insight.heroId === heroId,
      ),
    };

    await db.execute(
      'UPDATE heroes SET raw_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(updatedHero), heroId],
    );
    updatedHeroIds.push(heroId);
  }

  const unmatchedDatabaseHeroIds = result.rows
    .map((row) => String(row.id))
    .filter((heroId) => !HERO_GAMEPLAY_ARCHETYPES[heroId]);
  const finishedAt = new Date().toISOString();
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

  await upsertExternalSource(JSON.stringify(sourcePayload), finishedAt, 'success', null);
  await finishSyncRun(runId, 'success', message, finishedAt);

  console.log(message);
} catch (error) {
  const finishedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : String(error);

  await upsertExternalSource('{}', finishedAt, 'error', message);
  await finishSyncRun(runId, 'error', message, finishedAt);
  throw error;
} finally {
  db.close();
}

async function insertSyncRun(syncSourceKey, syncStartedAt) {
  const result = await db.execute(
    `INSERT INTO sync_runs (source_key, status, message, started_at)
    VALUES (?, 'running', ?, ?)`,
    [syncSourceKey, 'Syncing Season 9 gameplay archetypes into hero records.', syncStartedAt],
  );

  return Number(result.lastInsertRowid);
}

async function finishSyncRun(id, status, message, finishedAt) {
  await db.execute(
    `UPDATE sync_runs
    SET status = ?, message = ?, finished_at = ?
    WHERE id = ?`,
    [status, message, finishedAt, id],
  );
}

async function upsertExternalSource(payloadJson, fetchedAt, status, error) {
  await db.execute(
    `INSERT INTO external_sources (
      source_key, source_name, url, payload_json, fetched_at, status, error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      source_name = excluded.source_name,
      url = excluded.url,
      payload_json = excluded.payload_json,
      fetched_at = excluded.fetched_at,
      status = excluded.status,
      error = excluded.error`,
    [sourceKey, sourceName, sourceUrl, payloadJson, fetchedAt, status, error],
  );
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
