// Proves the game stats (issue 109) reached Supabase intact. Issue 110 deletes this file together
// with the rest of Turso.
//
//   node scripts/verify-game-stats.mjs capture [--base <url>]
//     Before the cutover: saves `GET /api/game-stats` to data/turso-cutover/109/game-stats.json.
//     Take it before writing the data migration, so the hours it names are in the copy.
//
//   node scripts/verify-game-stats.mjs
//     After `npx supabase db push`: every capture the data migration copied, and its games, against
//     Turso (counts, every row, five named rows per table printed); RLS on, no policy and no
//     privilege for `anon` or `authenticated` on the tables, their sequences and the function; and
//     the captured endpoint JSON rebuilt from Supabase.
//
//   node scripts/verify-game-stats.mjs live [--base <url>]
//     After the merge deploys: the live endpoint stores and reads its captures in Supabase, and
//     everything in it that does not move by the hour equals the capture.
//
//   node scripts/verify-game-stats.mjs top-up
//     After the top-up SQL is applied: every hour Turso captured is in Supabase.
//
//   node scripts/verify-game-stats.mjs sync-run
//     After the hourly cron has run once: its latest `sync_runs` row is a success.
//
// Reads Supabase through the linked CLI (`npx supabase link` once per machine), so it needs no
// service key, and plain SQL, so PostgREST's 1000-row cap does not apply; reads Turso through
// TURSO_* in .env. `--base` defaults to https://rivalspulse.com. Exits 1 on any difference.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshotComparison, GAME_STATS_SYNC_KEY } from '../src/game-stats-sync.ts';
import { createTursoClient } from './turso-client.mjs';
import { selectRows } from './turso-data-migration.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE_PATH = join(root, 'data', 'turso-cutover', '109', 'game-stats.json');
const MIGRATIONS_DIR = join(root, 'supabase', 'migrations');
const TABLES = ['game_stat_snapshots', 'game_stat_snapshot_games'];
const FUNCTION_SIGNATURE = 'public.record_game_stat_snapshot(timestamptz, text, timestamptz, text, text, jsonb)';
// Every table privilege Postgres has. The project's default privileges grant all of them to `anon`
// and `authenticated` on any new table in `public`, so the migration's `revoke all` is the only
// thing keeping the publishable key out.
const TABLE_PRIVILEGES = ['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'];
const SEQUENCE_PRIVILEGES = ['usage', 'select', 'update'];
const PUBLIC_ROLES = ['anon', 'authenticated'];
// Snapshot ids spread over the history, and one game of each. The capture's snapshot is checked too.
const NAMED_SNAPSHOTS = [1, 500, 1000, 2000];
const NAMED_GAMES = ['1:2767030', '500:570', '1000:730', '2000:2357570'];
// What in the endpoint does not move by the hour: compared with the capture as it is.
const STABLE_GAME_FIELDS = [
  'appId', 'name', 'category', 'dailyPeak', 'allTimePeak', 'steamDailyRank', 'topSellerRank',
  'twitchViewers', 'reviewSummary', 'sourceUrl',
];

const mode = process.argv[2]?.startsWith('--') ? 'db' : (process.argv[2] ?? 'db');
const base = (getArg('--base') ?? 'https://rivalspulse.com').replace(/\/+$/, '');
const failures = [];
const notes = [];

switch (mode) {
  case 'capture':
    await capture();
    break;
  case 'db':
    await verifyDatabase();
    break;
  case 'live':
    await verifyLive();
    break;
  case 'top-up':
    await verifyTopUp();
    break;
  case 'sync-run':
    verifySyncRun();
    break;
  default:
    console.error(`Unknown mode "${mode}". Use capture, live, top-up, sync-run or nothing.`);
    process.exit(2);
}

for (const note of notes) {
  console.log(`NOTE  ${note}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`FAIL  ${failure}`);
  }
  process.exit(1);
}

console.log('All checks passed.');

async function capture() {
  const response = await getGameStats();

  check('the endpoint stored its capture', response.snapshot?.persisted === true, JSON.stringify(response.snapshot));
  mkdirSync(dirname(CAPTURE_PATH), { recursive: true });
  writeFileSync(CAPTURE_PATH, `${JSON.stringify({ capturedAt: new Date().toISOString(), base, response }, null, 2)}\n`);
  console.log(`Saved ${CAPTURE_PATH}: snapshot ${response.snapshot?.id}, previous ${response.previousSnapshot?.id}.`);
}

async function verifyDatabase() {
  const lastHour = lastHourCopied();
  const turso = await readTurso('WHERE s.capture_bucket <= ?', [lastHour]);
  const supabase = readSupabase(`where s.capture_bucket <= '${lastHour}'::timestamptz`);
  const captured = readCapture();

  console.log(`The data migration copies every capture up to ${lastHour}.`);
  compareTable('game_stat_snapshots', turso.snapshots, supabase.snapshots, (row) => row.id, [
    ...NAMED_SNAPSHOTS,
    captured.response.snapshot.id,
  ]);
  compareTable('game_stat_snapshot_games', turso.games, supabase.games, gameKey, [
    ...NAMED_GAMES,
    `${captured.response.snapshot.id}:1172470`,
  ]);

  const later = await countTursoHoursAfter(lastHour);

  if (later > 0) {
    notes.push(`Turso has ${later} hour(s) after ${lastHour}; after the merge, copy them with the export script's --top-up.`);
  }

  verifyLockedDown();
  compareWithCapture(captured.response, supabase);
}

async function verifyLive() {
  const response = await getGameStats();
  const captured = readCapture().response;
  const supabase = readSupabase(
    `where s.id in (${[response.snapshot?.id, response.previousSnapshot?.id].filter(Number.isInteger).join(', ') || 'null'})`,
  );

  check('the live capture was stored', response.snapshot?.persisted === true, JSON.stringify(response.snapshot));
  check(
    'the live capture is the Supabase row of its hour',
    sameReference(response.snapshot, snapshotById(supabase, response.snapshot?.id)) &&
      hourOf(response.snapshot.capturedAt) === snapshotById(supabase, response.snapshot.id).capture_bucket,
    JSON.stringify(response.snapshot),
  );
  check(
    'the live previous capture is the Supabase row of the hour before it',
    sameReference(response.previousSnapshot, previousInSupabase(response.snapshot?.capturedAt)),
    JSON.stringify(response.previousSnapshot),
  );
  compareComparisons('live', response, supabase);

  const stable = (body) => ({
    currentPlayerSource: body.currentPlayerSource,
    currentPlayerSourceUrl: body.currentPlayerSourceUrl,
    keys: Object.keys(body).sort(),
    games: body.games.map((game) => Object.fromEntries(STABLE_GAME_FIELDS.map((field) => [field, game[field]]))),
  });
  const differences = diff(stable(captured), stable(response));

  check('the live endpoint equals the capture apart from the hourly values', differences.length === 0, differences.join('; '));
  notes.push(
    'Expected to differ from the capture: fetchedAt, snapshotDate, snapshot, previousSnapshot, each ' +
      'game\'s currentPlayers (live from Steam) and comparison (rebuilt above from Supabase).',
  );
}

async function verifyTopUp() {
  const turso = await readTurso('', []);
  const supabase = readSupabase('');
  const stored = new Map(supabase.snapshots.map((row) => [row.capture_bucket, row]));
  const storedGames = new Map(supabase.games.map((row) => [`${row.snapshot_id}:${row.app_id}`, row]));
  let equal = 0;

  for (const snapshot of turso.snapshots) {
    const match = stored.get(snapshot.capture_bucket);

    if (!match) {
      failures.push(`hour ${snapshot.capture_bucket} is missing in Supabase`);
      continue;
    }

    if (match.captured_at !== snapshot.captured_at) {
      notes.push(`hour ${snapshot.capture_bucket} was captured by both databases during the cutover; Supabase keeps its own`);
      continue;
    }

    const games = turso.games.filter((game) => game.snapshot_id === snapshot.id);
    const differences = [
      ...diff(withoutIds(snapshot), withoutIds(match)),
      ...games.flatMap((game) => diff(withoutIds(game), withoutIds(storedGames.get(`${match.id}:${game.app_id}`)))),
    ];

    if (differences.length === 0) {
      equal += 1;
    } else {
      failures.push(`hour ${snapshot.capture_bucket}: ${differences.join('; ')}`);
    }
  }

  console.log(`${equal} of ${turso.snapshots.length} Turso hours equal in Supabase, with their games.`);
}

function verifySyncRun() {
  const [run] = querySupabase(`select id, status, message, details, started_at, finished_at
    from public.sync_runs where source_key = '${GAME_STATS_SYNC_KEY}' order by started_at desc limit 1`);
  const snapshotId = run?.details?.snapshotId;
  const [snapshot] = Number.isInteger(snapshotId)
    ? querySupabase(`select id from public.game_stat_snapshots where id = ${snapshotId}`)
    : [];

  check(`latest ${GAME_STATS_SYNC_KEY} run is a success`, run?.status === 'success', `latest: ${JSON.stringify(run ?? null)}`);
  check('its snapshot is in Supabase', snapshot !== undefined, `snapshot ${snapshotId}`);

  if (run?.status === 'success') {
    console.log(`  run ${run.id}: "${run.message}", started ${run.started_at}`);
  }
}

/** The captured response, rebuilt from Supabase: its two snapshots and every comparison. */
function compareWithCapture(response, supabase) {
  check(
    'the captured snapshot is in Supabase',
    sameReference(response.snapshot, snapshotById(supabase, response.snapshot.id)),
    JSON.stringify(response.snapshot),
  );
  check(
    'the captured previous snapshot is the Supabase row of the hour before it',
    sameReference(response.previousSnapshot, previousInSupabase(response.snapshot.capturedAt)),
    JSON.stringify(response.previousSnapshot),
  );
  compareComparisons('captured', response, supabase);
}

// The comparisons are the only part of a response built from stored rows; the rest is live Steam
// data or fixed metadata. Rebuilding them from Supabase with the endpoint's own code must give back
// exactly what the endpoint served.
function compareComparisons(label, response, supabase) {
  const previousId = response.previousSnapshot?.id;
  const previousGames = supabase.games.filter((game) => game.snapshot_id === previousId);
  const differences = response.games.flatMap((game) => {
    const { comparison, ...current } = game;
    const previous = previousGames.find((row) => row.app_id === game.appId);
    const rebuilt = buildSnapshotComparison(
      current,
      previous && toGameComparison(previous),
      snapshotById(supabase, previousId)?.captured_at,
    );

    return diff(comparison, rebuilt, `$.games[${game.appId}].comparison`);
  });

  check(`the ${label} comparisons rebuilt from Supabase are deep-equal`, differences.length === 0, differences.join('; '));
}

function previousInSupabase(capturedAt) {
  if (!capturedAt) {
    return undefined;
  }

  const [row] = querySupabase(`select id, snapshot_date, ${iso('captured_at')}, ${iso('capture_bucket')}
    from public.game_stat_snapshots where capture_bucket < '${hourOf(capturedAt)}'::timestamptz
    order by capture_bucket desc limit 1`);

  return row;
}

function sameReference(reference, row) {
  return (
    reference !== undefined &&
    row !== undefined &&
    reference.persisted === true &&
    reference.id === Number(row.id) &&
    reference.snapshotDate === row.snapshot_date &&
    reference.capturedAt === row.captured_at
  );
}

function snapshotById(supabase, id) {
  return supabase.snapshots.find((row) => row.id === id);
}

async function readTurso(where, args) {
  const db = createTursoClient();

  try {
    const snapshots = await selectRows(db, `SELECT s.* FROM game_stat_snapshots s ${where} ORDER BY s.id`, args);
    const games = await selectRows(
      db,
      `SELECT g.* FROM game_stat_snapshot_games g JOIN game_stat_snapshots s ON s.id = g.snapshot_id ${where} ORDER BY g.id`,
      args,
    );

    return { snapshots: snapshots.map(normalizeSnapshot), games: games.map(normalizeGame) };
  } finally {
    db.close();
  }
}

async function countTursoHoursAfter(lastHour) {
  const db = createTursoClient();

  try {
    const [{ hours }] = await selectRows(db, 'SELECT count(*) AS hours FROM game_stat_snapshots WHERE capture_bucket > ?', [lastHour]);

    return Number(hours);
  } finally {
    db.close();
  }
}

function readSupabase(where) {
  const snapshots = querySupabase(`select s.id, ${iso('capture_bucket', 's')}, s.snapshot_date, ${iso('captured_at', 's')},
      s.current_player_source, s.current_player_source_url, ${iso('created_at', 's')}
    from public.game_stat_snapshots s ${where} order by s.id`);
  const games = querySupabase(`select g.* from public.game_stat_snapshot_games g
    join public.game_stat_snapshots s on s.id = g.snapshot_id ${where} order by g.id`);

  return { snapshots: snapshots.map(normalizeSnapshot), games: games.map(normalizeGame) };
}

// RLS on, no policy, and no privilege at all for the publishable key's roles.
function verifyLockedDown() {
  const quote = (values) => values.map((value) => `'${value}'`).join(', ');
  const tables = TABLES.map((table) => `'public.${table}'::regclass`).join(', ');
  const rls = querySupabase(`select c.relname, c.relrowsecurity as rls,
      (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
    from pg_class c where c.oid in (${tables}) order by c.relname`);

  for (const table of TABLES) {
    const row = rls.find((candidate) => candidate.relname === table);

    check(`${table} has RLS on and no policy`, row?.rls === true && row.policies === 0, JSON.stringify(row ?? 'missing'));
  }

  const privileges = querySupabase(`
    with target as (select unnest(array[${tables}]) as oid),
    sequences as (
      select d.objid as oid
      from pg_depend d join pg_class s on s.oid = d.objid join target on d.refobjid = target.oid
      where d.classid = 'pg_class'::regclass and d.deptype in ('a', 'i') and s.relkind = 'S'
    )
    select 'table' as kind, target.oid::regclass::text as name, r.role, p.privilege,
      has_table_privilege(r.role, target.oid, p.privilege) as granted
    from target, unnest(array[${quote(PUBLIC_ROLES)}]) as r(role),
      unnest(array[${quote(TABLE_PRIVILEGES)}]) as p(privilege)
    union all
    select 'sequence', s.oid::regclass::text, r.role, p.privilege,
      has_sequence_privilege(r.role, s.oid, p.privilege)
    from sequences s, unnest(array[${quote(PUBLIC_ROLES)}]) as r(role),
      unnest(array[${quote(SEQUENCE_PRIVILEGES)}]) as p(privilege)
    union all
    select 'function', '${FUNCTION_SIGNATURE}', r.role, 'execute',
      has_function_privilege(r.role, '${FUNCTION_SIGNATURE}'::regprocedure, 'execute')
    from unnest(array[${quote([...PUBLIC_ROLES, 'service_role'])}]) as r(role)`);
  const expectedTables = TABLES.length * PUBLIC_ROLES.length * TABLE_PRIVILEGES.length;
  const tableRows = privileges.filter((row) => row.kind === 'table');
  const sequences = [...new Set(privileges.filter((row) => row.kind === 'sequence').map((row) => row.name))];
  const granted = privileges.filter((row) => row.role !== 'service_role' && row.granted !== false);
  const serviceRole = privileges.find((row) => row.kind === 'function' && row.role === 'service_role');

  check('table privileges checked', tableRows.length === expectedTables, `${tableRows.length} of ${expectedTables} came back`);
  check('both identity sequences checked', sequences.length === TABLES.length, sequences.join(', ') || 'none');
  check(
    `nothing granted to ${PUBLIC_ROLES.join(' or ')} (${TABLE_PRIVILEGES.join(', ')} on the tables; ` +
      `${SEQUENCE_PRIVILEGES.join(', ')} on ${sequences.join(', ')}; execute on the function)`,
    granted.length === 0,
    granted.map((row) => `${row.role} has ${row.privilege} on ${row.kind} ${row.name}`).join('; '),
  );
  check('service_role can execute the function', serviceRole?.granted === true, JSON.stringify(serviceRole ?? null));
}

function compareTable(table, tursoRows, supabaseRows, keyOf, named) {
  check(`${table} row count`, tursoRows.length === supabaseRows.length, `Turso ${tursoRows.length}, Supabase ${supabaseRows.length}`);

  const stored = new Map(supabaseRows.map((row) => [keyOf(row), row]));
  let equal = 0;

  for (const row of tursoRows) {
    const differences = diff(row, stored.get(keyOf(row)));

    if (differences.length === 0) {
      equal += 1;
    } else {
      failures.push(`${table} ${keyOf(row)}: ${differences.join('; ')}`);
    }
  }

  console.log(`${table}: ${equal} of ${tursoRows.length} Turso rows equal in Supabase.`);

  for (const key of named) {
    const row = tursoRows.find((candidate) => keyOf(candidate) === key);
    const same = row !== undefined && diff(row, stored.get(key)).length === 0;

    console.log(`  ${same ? 'equal' : 'DIFFERENT'}  ${key}`);

    if (!same) {
      failures.push(`${table} named row ${key} is ${row ? 'different' : 'not in Turso'}`);
    }
  }
}

// Turso keeps timestamps as text: the sync's own in `toISOString()` form, `created_at` as SQLite's
// zoneless UTC CURRENT_TIMESTAMP. Supabase's come back from `iso()` in `toISOString()` form.
function normalizeSnapshot(row) {
  return {
    id: Number(row.id),
    capture_bucket: instant(row.capture_bucket),
    snapshot_date: row.snapshot_date,
    captured_at: instant(row.captured_at),
    current_player_source: row.current_player_source,
    current_player_source_url: row.current_player_source_url,
    created_at: instant(row.created_at),
  };
}

function normalizeGame(row) {
  return {
    id: Number(row.id),
    snapshot_id: Number(row.snapshot_id),
    app_id: Number(row.app_id),
    name: row.name,
    category: row.category,
    current_players: Number(row.current_players),
    daily_peak: Number(row.daily_peak),
    all_time_peak: Number(row.all_time_peak),
    steam_daily_rank: row.steam_daily_rank,
    top_seller_rank: row.top_seller_rank,
    twitch_viewers: Number(row.twitch_viewers),
    review_summary: row.review_summary,
    source_url: row.source_url,
  };
}

function toGameComparison(row) {
  return {
    appId: row.app_id,
    name: row.name,
    category: row.category,
    currentPlayers: row.current_players,
    dailyPeak: row.daily_peak,
    allTimePeak: row.all_time_peak,
    steamDailyRank: row.steam_daily_rank,
    topSellerRank: row.top_seller_rank,
    twitchViewers: row.twitch_viewers,
    reviewSummary: row.review_summary,
    sourceUrl: row.source_url,
  };
}

function withoutIds({ id: _id, snapshot_id: _snapshotId, ...rest }) {
  return rest;
}

function gameKey(row) {
  return `${row.snapshot_id}:${row.app_id}`;
}

function iso(column, alias) {
  const name = alias ? `${alias}.${column}` : column;

  return `to_char(${name} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as ${column}`;
}

function instant(value) {
  const text = String(value).replace(' ', 'T');

  return new Date(/([zZ]|[+-]\d\d(:?\d\d)?)$/.test(text) ? text : `${text}Z`).toISOString();
}

function hourOf(capturedAt) {
  const date = new Date(capturedAt);
  date.setUTCMinutes(0, 0, 0);

  return date.toISOString();
}

function lastHourCopied() {
  const file = readdirSync(MIGRATIONS_DIR).find((name) => name.endsWith('_game_stats_data.sql'));
  const match = file && /^-- Last hour copied: (\S+)$/m.exec(readFileSync(join(MIGRATIONS_DIR, file), 'utf8'));

  if (!match) {
    console.error('No game stats data migration with a "-- Last hour copied:" line in supabase/migrations.');
    process.exit(2);
  }

  return match[1];
}

function readCapture() {
  const captured = JSON.parse(readFileSync(CAPTURE_PATH, 'utf8'));

  console.log(`Capture taken ${captured.capturedAt} from ${captured.base}.`);

  return captured;
}

async function getGameStats() {
  // A fresh query string, so the CDN's five-minute copy of the endpoint is not what gets checked.
  const url = `${base}/api/game-stats?verify=${Date.now()}`;
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`${url} answered ${response.status}.`);
    process.exit(1);
  }

  return response.json();
}

// The CLI sometimes fails or stalls while it sets up its login role, so a query gets three tries.
function querySupabase(sql, attempts = 3) {
  const cli = join(dirname(createRequire(import.meta.url).resolve('supabase/package.json')), 'dist', 'supabase.js');
  const dir = mkdtempSync(join(tmpdir(), 'verify-game-stats-'));
  const file = join(dir, 'query.sql');

  try {
    writeFileSync(file, sql);

    for (let attempt = 1; ; attempt += 1) {
      const result = spawnSync(
        process.execPath,
        [cli, 'db', 'query', '--linked', '--output-format', 'json', '--agent', 'no', '--file', file],
        { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: 120_000 },
      );

      if (result.status === 0) {
        return JSON.parse(result.stdout);
      }

      if (attempt === attempts) {
        throw new Error(`supabase db query failed: ${result.error?.message ?? ''} ${result.stderr} ${result.stdout}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function check(label, passed, detail) {
  if (passed) {
    console.log(`${label}: ok.`);
  } else {
    failures.push(`${label}: ${detail}`);
  }
}

/** Paths where two JSON values differ, ignoring object key order (`jsonb` does not keep it). */
function diff(expected, actual, path = '$', found = []) {
  if (found.length >= 10) {
    return found;
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      found.push(`${path} has ${actual.length} items, expected ${expected.length}`);
    }

    for (let index = 0; index < Math.min(expected.length, actual.length); index += 1) {
      diff(expected[index], actual[index], `${path}[${index}]`, found);
    }
  } else if (isObject(expected) && isObject(actual)) {
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      diff(expected[key], actual[key], `${path}.${key}`, found);
    }
  } else if (expected !== actual) {
    found.push(`${path} is ${preview(actual)}, expected ${preview(expected)}`);
  }

  return found;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function preview(value) {
  const text = JSON.stringify(value) ?? 'undefined';

  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

function getArg(name) {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}
