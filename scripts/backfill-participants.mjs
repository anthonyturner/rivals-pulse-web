/**
 * One-off backfill (issue 143): replays the matches stored in `tracked_matches` through
 * `record_match_participants`, so the community stats start with the history the overlay already
 * uploaded instead of the last week.
 *
 *   npm run backfill:participants                     dry run: reads, writes nothing
 *   npm run backfill:participants -- --apply          replays for real
 *   --before-first-half-season=9.5                    half-season for matches older than every row of `half_seasons`
 *
 * It talks to the linked project through `npx supabase db query --linked`, the route
 * docs/supabase.md prescribes for live checks (reads in a dry run, one write per half-season on
 * --apply), so no service key is read or stored. The report names no player.
 * Run it after the hero aggregates (issue 142) are live: replayed rows of an ended half-season
 * are frozen into the aggregates, then deleted, by the purge.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EARLIEST_BEFORE_FIRST_PLAY, labelledBeforeSeason9, planReplay, prepareRecorderLine, prepareReplay, readQueryOutput, replayStatement } from './participants-replay.ts';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const PAGE_SIZE = 150;
const ISO_UTC = `'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'`;

const options = readOptions(process.argv.slice(2));
const mode = options.apply ? 'APPLY (writes to the linked project)' : 'DRY RUN (reads only, writes nothing)';
console.log(`Participants backfill: ${mode}\n`);

const starts = query(
  `select half_season::float8 as half_season, to_char(starts_at at time zone 'utc', ${ISO_UTC}) as starts_at from public.half_seasons`,
);
const frozen = new Set(
  query('select half_season::float8 as half_season from public.hero_aggregate_half_seasons where frozen_at is not null')
    .map(row => Number(row.half_season)),
);
if (options.beforeFirst !== null && options.beforeFirst >= Math.min(...starts.map(row => Number(row.half_season)))) {
  fail('--before-first-half-season must be earlier than every half-season in the half_seasons table');
}

const tracked = readTrackedMatches();
const existing = readStoredLines();
const prepared = await Promise.all(tracked.map(async row => {
  const item = await prepareReplay(row, starts, options.beforeFirst);
  if (item.skipped !== 'no-roster') return item;
  const recorderLine = await prepareRecorderLine(row, existing);
  return recorderLine ? { match: recorderLine } : item;
}));
const skippedBy = count(prepared.filter(item => 'skipped' in item), item => item.skipped);
const matches = prepared
  .flatMap(item => ('match' in item ? [item.match] : []))
  .sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt) || a.rowId - b.rowId);

const planned = planReplay(matches, existing, frozen);

report();

if (options.apply) apply();
else console.log('\nDry run only. Nothing was written. Re-run with --apply to replay.');

function report() {
  console.log(`Tracked matches read: ${tracked.length}`);
  console.log(`Stored scoreboard lines: ${existing.length}; half-seasons already frozen: ${[...frozen].join(', ') || 'none'}`);
  console.log(`Not replayable: ${formatCounts(skippedBy) || 'none'} (a stored row keeps its roster only if an older app uploaded it)\n`);

  const rows = halfSeasons().map(halfSeason => {
    const inSeason = planned.filter(item => item.match.halfSeason === halfSeason);
    const replayed = inSeason.filter(item => item.outcome !== 'frozen');
    const lines = replayed.flatMap(item => item.match.lines);
    return {
      'half-season': halfSeason ?? 'unplaced',
      from: inSeason[0].match.playedAt.slice(0, 10),
      to: inSeason.at(-1).match.playedAt.slice(0, 10),
      matches: inSeason.length,
      new: countOutcome(inSeason, 'new'),
      'repeat (stored)': countOutcome(inSeason, 'repeat-existing'),
      'of which recorder line': inSeason.filter(item => item.outcome === 'repeat-existing' && item.match.source === 'recorder-line').length,
      'repeat (this run)': countOutcome(inSeason, 'repeat-in-run'),
      frozen: countOutcome(inSeason, 'frozen'),
      'new lines': inSeason.filter(item => item.outcome === 'new').reduce((sum, item) => sum + item.match.lines.length, 0),
      'lines without a result': lines.filter(line => line.is_win === null).length,
      'matches without a mode': replayed.filter(item => item.match.playModeId === null).length,
      'statement KB': replayed.length ? Math.ceil(replayStatement(replayed).length / 1024) : 0,
    };
  });
  console.table(rows);

  for (const source of ['roster', 'recorder-line']) {
    const repeats = planned.filter(item => item.outcome === 'repeat-existing' && item.match.source === source);
    const sum = key => repeats.reduce((total, item) => total + item[key], 0);
    const decided = sum('agreed') + sum('disagreed');
    const span = repeats.length
      ? ` (${repeats[0].match.playedAt.slice(0, 10)} to ${repeats.at(-1).match.playedAt.slice(0, 10)})`
      : '';
    console.log(`
Agreement with stored lines, matched by ${source}: ${repeats.length} repeat matches${span}`);
    console.log(`  decided lines compared: ${decided}, agreeing: ${sum('agreed')}, disagreeing: ${sum('disagreed')}` +
      (decided ? ` (${((100 * sum('agreed')) / decided).toFixed(2)} percent agree)` : ''));
    console.log(`  blank stored results this fills: ${sum('resultsFilled')}; matches whose blank mode or map this fills: ${repeats.filter(item => item.modeOrMapFilled).length}`);
  }

  const team = count(matches.filter(match => match.source === 'roster'), match => match.recorderTeam);
  const tooOld = labelledBeforeSeason9(planned, options.beforeFirst).length;
  if (tooOld > 0) console.log(`
WARNING: ${tooOld} matches labelled ${options.beforeFirst} predate ${EARLIEST_BEFORE_FIRST_PLAY}; --apply will refuse.`);

  console.log(`
Recorder line on the team the row stored (matches with a roster): ${formatCounts(team)}`);
}

function apply() {
  const tooOld = labelledBeforeSeason9(planned, options.beforeFirst).length;
  if (tooOld > 0) fail(`${tooOld} matches labelled ${options.beforeFirst} were played before ${EARLIEST_BEFORE_FIRST_PLAY}; the label is wrong for them`);
  const unplaced = planned.filter(item => item.outcome === 'unplaced').length;
  if (unplaced > 0) fail(`${unplaced} matches belong to no known half-season; pass --before-first-half-season (see the dry run)`);

  console.log('\nReplaying, one transaction per half-season:');
  for (const halfSeason of halfSeasons().filter(value => value !== null)) {
    const toReplay = planned.filter(item => item.match.halfSeason === halfSeason && item.outcome !== 'frozen');
    if (toReplay.length === 0) continue;

    const written = query(replayStatement(toReplay)).reduce((total, row) => total + Number(row.written), 0);
    const expected = toReplay.filter(item => item.outcome === 'new').reduce((total, item) => total + item.match.lines.length, 0);
    console.log(`  ${halfSeason}: ${toReplay.length} matches replayed, ${written} lines written (${expected} expected before any do-not-store skips)`);
  }
  console.log('\nDone. Run the dry run again: it must now show 0 new matches. The next upload, or the daily purge, freezes the ended half-seasons.');
}

function halfSeasons() {
  const values = [...new Set(planned.map(item => item.match.halfSeason))];
  return values.sort((a, b) => (a ?? Infinity) - (b ?? Infinity));
}

function countOutcome(items, outcome) {
  return items.filter(item => item.outcome === outcome).length;
}

function count(items, keyOf) {
  const counts = {};
  for (const item of items) counts[keyOf(item)] = (counts[keyOf(item)] ?? 0) + 1;
  return counts;
}

function formatCounts(counts) {
  return Object.entries(counts).map(([key, value]) => `${key} ${value}`).join(', ');
}

function readTrackedMatches() {
  const rows = [];
  for (let lastId = 0; ;) {
    const page = query(
      `select id, raw_payload, performance from public.tracked_matches where id > ${lastId} order by id limit ${PAGE_SIZE}`,
    );
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
    lastId = page.at(-1).id;
  }
}

function readStoredLines() {
  const lines = [];
  for (let lastId = 0; ;) {
    const page = query(
      `select id, fingerprint, half_season::float8 as half_season, to_char(played_at at time zone 'utc', ${ISO_UTC}) as played_at, uid, name, is_win, play_mode_id, map_name ` +
      `from public.participants where id > ${lastId} order by id limit 1000`,
    );
    lines.push(...page.map(row => ({
      fingerprint: row.fingerprint,
      halfSeason: Number(row.half_season),
      playedAt: row.played_at,
      uid: row.uid,
      name: row.name,
      isWin: row.is_win,
      playModeId: row.play_mode_id,
      mapName: row.map_name,
    })));
    if (page.length < 1000) return lines;
    lastId = page.at(-1).id;
  }
}

/** Runs one SQL statement on the linked project and returns the rows of its last result. */
function query(sql) {
  const folder = mkdtempSync(join(tmpdir(), 'backfill-participants-'));
  const file = join(folder, 'query.sql');
  try {
    writeFileSync(file, sql);
    const result = spawnSync(`npx supabase db query --linked -f "${file}"`, {
      cwd: REPO_ROOT,
      shell: true,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    const output = readQueryOutput(result);
    if ('failure' in output) fail(output.failure);
    return output.rows;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

function readOptions(args) {
  const parsed = { apply: false, beforeFirst: null };
  for (const arg of args) {
    if (arg === '--dry-run') parsed.apply = false;
    else if (arg === '--apply') parsed.apply = true;
    else if (arg.startsWith('--before-first-half-season=')) parsed.beforeFirst = Number(arg.split('=')[1]);
    else fail(`unknown argument ${arg}`);
  }
  if (args.includes('--apply') && args.includes('--dry-run')) fail('--apply and --dry-run cannot be combined');
  if (parsed.beforeFirst !== null && !(Number.isFinite(parsed.beforeFirst) && Number.isInteger(parsed.beforeFirst * 2))) {
    fail('--before-first-half-season must be a whole or half number such as 9.5');
  }
  return parsed;
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}
