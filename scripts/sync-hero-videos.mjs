// Makes the hero videos in Supabase match data/seeds/hero-videos.mock.json: every listed video is
// saved at its position in the file, and a stored video the file no longer lists is removed.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { saveHeroVideos } from '../src/hero-video-store.ts';
import { finishSyncRun, startSyncRun } from '../src/sync-log.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const videosPath = join(__dirname, '..', 'data', 'seeds', 'hero-videos.mock.json');
const videos = JSON.parse(readFileSync(videosPath, 'utf8'));

const db = getSupabaseClient();
const runId = await startSyncRun(db, 'hero-videos', 'Syncing hero videos from the seed file');

try {
  const removed = await saveHeroVideos(db, videos);
  const message = `Synced ${videos.length} hero videos; removed ${removed.length}.`;

  await finishSyncRun(db, runId, { status: 'success', message, details: { removed } });
  console.log(message);
} catch (error) {
  await finishSyncRun(db, runId, {
    status: 'error',
    message: error instanceof Error ? error.message : String(error),
  });
  throw error;
}
