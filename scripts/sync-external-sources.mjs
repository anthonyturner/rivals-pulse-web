import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient, executeSchema } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'sqlite-schema.sql');

const sources = [
  {
    key: 'fandom-battlepasses',
    name: 'Marvel Rivals Fandom BattlePasses',
    url: 'https://marvelrivals.fandom.com/api.php?action=parse&page=BattlePasses&prop=wikitext&format=json&origin=*',
  },
  {
    key: 'fandom-deadpool',
    name: 'Marvel Rivals Fandom Deadpool',
    url: 'https://marvelrivals.fandom.com/api.php?action=parse&page=Deadpool&prop=wikitext&format=json&origin=*',
  },
  {
    key: 'fandom-deadpool-abilities-template',
    name: 'Marvel Rivals Fandom Deadpool Ability Template',
    url: 'https://marvelrivals.fandom.com/api.php?action=parse&page=Template:Abilities/Deadpool&prop=wikitext&format=json&origin=*',
  },
];

const db = createTursoClient();
await executeSchema(db, readFileSync(schemaPath, 'utf8'));

for (const source of sources) {
  const startedAt = new Date().toISOString();
  const runId = await insertSyncRun(source.key, 'running', `Fetching ${source.url}`, startedAt);

  try {
    const response = await fetch(source.url, {
      headers: {
        accept: 'application/json',
        'user-agent': 'rivals-pulse-content-sync/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    const fetchedAt = new Date().toISOString();

    await upsertSource(source, JSON.stringify(payload), fetchedAt, 'success', null);
    await finishSyncRun(runId, 'success', `Fetched ${source.name}`, fetchedAt);
    console.log(`Synced ${source.key}`);
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message : String(error);

    await upsertSource(source, '{}', finishedAt, 'error', message);
    await finishSyncRun(runId, 'error', message, finishedAt);
    console.error(`Failed ${source.key}: ${message}`);
  }
}

db.close();

async function insertSyncRun(sourceKey, status, message, startedAt) {
  const result = await db.execute(
    `INSERT INTO sync_runs (source_key, status, message, started_at)
    VALUES (?, ?, ?, ?)`,
    [sourceKey, status, message, startedAt],
  );

  return Number(result.lastInsertRowid);
}

async function finishSyncRun(runId, status, message, finishedAt) {
  await db.execute(
    `UPDATE sync_runs
    SET status = ?, message = ?, finished_at = ?
    WHERE id = ?`,
    [status, message, finishedAt, runId],
  );
}

async function upsertSource(source, payloadJson, fetchedAt, status, error) {
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
    [source.key, source.name, source.url, payloadJson, fetchedAt, status, error],
  );
}
