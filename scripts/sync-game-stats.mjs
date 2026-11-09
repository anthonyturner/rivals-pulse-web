import { recordSyncRun, runGameStatsCapture } from '../src/server/sync/index.ts';
import { reportGameStatsCapture } from './game-stats-report.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const report = reportGameStatsCapture(await runGameStatsCapture(getSupabaseClient(), recordSyncRun));

if (report.failed) {
  console.error(report.lines.join('\n'));
  process.exitCode = 1;
} else {
  console.log(report.lines.join('\n'));
}
