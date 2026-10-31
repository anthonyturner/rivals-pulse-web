import { finishSyncRun, saveExternalSource, startSyncRun } from '../src/sync-log.ts';
import { getSupabaseClient } from './supabase-client.mjs';

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

const db = getSupabaseClient();

for (const source of sources) {
  const runId = await startSyncRun(db, source.key, `Fetching ${source.url}`);

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

    await saveSource(source, await response.json(), 'success', null);
    await finishSyncRun(db, runId, { status: 'success', message: `Fetched ${source.name}` });
    console.log(`Synced ${source.key}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await saveSource(source, {}, 'error', message);
    await finishSyncRun(db, runId, { status: 'error', message });
    console.error(`Failed ${source.key}: ${message}`);
  }
}

function saveSource(source, payload, status, error) {
  return saveExternalSource(db, {
    sourceKey: source.key,
    sourceName: source.name,
    url: source.url,
    payload,
    fetchedAt: new Date().toISOString(),
    status,
    error,
  });
}
