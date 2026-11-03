import { recordSyncRun, runGameStatsSync } from '../src/server/sync/index.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const result = await runGameStatsSync(getSupabaseClient(), recordSyncRun);

console.log(`Saved game-stat snapshot for ${result.snapshotDate}.`);
console.log(`Games: ${result.games.length}`);
console.log(`Compared with: ${result.previousSnapshot?.snapshotDate ?? 'first stored snapshot'}`);
