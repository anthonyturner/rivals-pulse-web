// Checks the home content move from Turso to Supabase (issue 107). Needs the Turso variables in
// .env and a linked Supabase CLI (`npx supabase link`); it reads Supabase through
// `npx supabase db query --linked`, read-only, so no service key is needed. Issue 110 deletes this
// file together with the rest of Turso.
//
//   node scripts/verify-home-content-cutover.mjs capture   save the live endpoints (before the push)
//   node scripts/verify-home-content-cutover.mjs           after the push: Supabase against Turso and the capture
//   node scripts/verify-home-content-cutover.mjs live      after the merge: the live endpoints against the capture
//   node scripts/verify-home-content-cutover.mjs sync-run  after the first sync: a successful home-news run
//
// `capture` and `live` take `--base <url>` (default https://rivalspulse.com). Exits 1 on any
// difference and lists every one.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { createTursoClient } from './turso-client.mjs';
import { selectRows } from './turso-data-migration.mjs';

const CAPTURE_PATH = fileURLToPath(new URL('../data/cutover/home-endpoints.json', import.meta.url));
const SUPABASE_CLI = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const HOME_SOURCE_KEY = 'official-marvel-rivals-home';
const NEW_TABLES = ['home_portals', 'home_content_blocks'];
const mode = process.argv[2]?.startsWith('--') ? 'db' : (process.argv[2] ?? 'db');
const base = getArg('--base') ?? 'https://rivalspulse.com';

const failures = [];

switch (mode) {
  case 'capture':
    await capture();
    break;
  case 'db':
    await verifyDatabase();
    break;
  case 'live':
    compareEndpoints('live endpoints', await fetchEndpoints(), readCapture());
    break;
  case 'sync-run':
    verifySyncRun();
    break;
  default:
    console.error(`Unknown mode "${mode}". Use capture, db, live or sync-run.`);
    process.exit(2);
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('\nAll checks passed.');

async function capture() {
  const endpoints = await fetchEndpoints();
  const turso = await readTurso();

  compareEndpoints('the live endpoints against Turso', endpoints, endpointsFrom(turso));
  mkdirSync(join(CAPTURE_PATH, '..'), { recursive: true });
  writeFileSync(
    CAPTURE_PATH,
    `${JSON.stringify({ capturedAt: new Date().toISOString(), base, ...endpoints }, null, 2)}\n`,
  );
  console.log(`Saved ${CAPTURE_PATH}.`);
}

async function verifyDatabase() {
  const turso = await readTurso();
  const supabase = readSupabase();

  compareTable('home_portals', turso.portals, supabase.portals, (row) => row.path);
  compareTable('home_content_blocks', turso.blocks, supabase.blocks, (row) => row.content_key);
  compareTable('external_sources (home key)', turso.sources, supabase.sources, (row) => row.source_key);
  verifyLockedDown();
  compareEndpoints('endpoints built from Supabase against the capture', endpointsFrom(supabase), readCapture());
}

function verifySyncRun() {
  const [run] = querySupabase(`select id, status, message, started_at, finished_at from public.sync_runs
    where source_key = 'home-news' order by started_at desc limit 1`);

  if (run?.status === 'success') {
    console.log(`Latest home-news run ${run.id}: success, "${run.message}", started ${run.started_at}.`);
  } else {
    failures.push(`no successful home-news run in sync_runs (latest: ${JSON.stringify(run ?? null)})`);
  }
}

async function readTurso() {
  const db = createTursoClient();

  try {
    const [portals, blocks, sources] = await Promise.all([
      selectRows(db, 'SELECT * FROM home_portals ORDER BY id'),
      selectRows(db, 'SELECT * FROM home_content_blocks ORDER BY content_key'),
      selectRows(db, 'SELECT * FROM external_sources WHERE source_key = ?', [HOME_SOURCE_KEY]),
    ]);

    return {
      portals: portals.map((row) => ({
        id: Number(row.id),
        title: row.title,
        description: row.description,
        path: row.path,
        image: row.image,
        sort_order: Number(row.sort_order),
        raw_json: JSON.parse(row.raw_json),
        updated_at: utcMillis(row.updated_at),
      })),
      blocks: blocks.map((row) => ({
        content_key: row.content_key,
        payload: JSON.parse(row.payload_json),
        updated_at: utcMillis(row.updated_at),
      })),
      sources: sources.map((row) => ({
        source_key: row.source_key,
        source_name: row.source_name,
        url: row.url,
        payload: JSON.parse(row.payload_json),
        fetched_at: utcMillis(row.fetched_at),
        status: row.status,
        error: row.error,
      })),
    };
  } finally {
    db.close();
  }
}

function readSupabase() {
  const millis = (column) => `round(extract(epoch from ${column}) * 1000)::bigint as ${column}`;

  return {
    portals: querySupabase(`select id, title, description, path, image, sort_order, raw_json,
      ${millis('updated_at')} from public.home_portals order by id`).map(withNumbers('id', 'updated_at')),
    blocks: querySupabase(`select content_key, payload, ${millis('updated_at')}
      from public.home_content_blocks order by content_key`).map(withNumbers('updated_at')),
    sources: querySupabase(`select source_key, source_name, url, payload, ${millis('fetched_at')}, status, error
      from public.external_sources where source_key = '${HOME_SOURCE_KEY}'`).map(withNumbers('fetched_at')),
  };
}

// RLS on, no policy, and nothing granted to the publishable key's roles.
function verifyLockedDown() {
  const tables = NEW_TABLES.map((table) => `'${table}'`).join(', ');
  const rows = querySupabase(`select c.relname,
      c.relrowsecurity as rls,
      (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies,
      has_table_privilege('anon', c.oid, 'select, insert, update, delete') as anon,
      has_table_privilege('authenticated', c.oid, 'select, insert, update, delete') as authenticated
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relname in (${tables})
    order by c.relname`);

  for (const table of NEW_TABLES) {
    const row = rows.find((candidate) => candidate.relname === table);
    const ok = row?.rls === true && row.policies === 0 && !row.anon && !row.authenticated;

    console.log(`${ok ? 'ok  ' : 'FAIL'} ${table}: ${JSON.stringify(row ?? 'missing')}`);

    if (!ok) {
      failures.push(`${table} is not locked down: ${JSON.stringify(row ?? 'missing')}`);
    }
  }
}

function compareTable(label, tursoRows, supabaseRows, keyOf) {
  console.log(`\n${label}: Turso ${tursoRows.length} rows, Supabase ${supabaseRows.length} rows`);

  if (tursoRows.length !== supabaseRows.length) {
    failures.push(`${label}: row counts differ (Turso ${tursoRows.length}, Supabase ${supabaseRows.length})`);
  }

  for (const tursoRow of tursoRows) {
    const key = keyOf(tursoRow);
    const supabaseRow = supabaseRows.find((row) => keyOf(row) === key);
    const differences = supabaseRow ? listDifferences(tursoRow, supabaseRow) : ['missing in Supabase'];

    console.log(`${differences.length ? 'FAIL' : 'ok  '} ${key}`);
    differences.forEach((difference) => failures.push(`${label} ${key}: ${difference}`));
  }
}

function compareEndpoints(label, actual, expected) {
  console.log(`\nComparing ${label}:`);

  for (const name of ['portals', 'content']) {
    const differences = listDifferences(expected[name], actual[name]);

    console.log(`${differences.length ? 'FAIL' : 'ok  '} /api/home/${name}${differences.length ? '' : ' (deep-equal)'}`);
    differences.forEach((difference) => failures.push(`/api/home/${name} ${difference}`));
  }
}

// The same shaping as src/home-content-store.ts: portals by sort_order, blocks keyed by name.
function endpointsFrom({ portals, blocks }) {
  return {
    portals: [...portals].sort((left, right) => left.sort_order - right.sort_order).map((row) => row.raw_json),
    content: Object.fromEntries(blocks.map((row) => [row.content_key, row.payload])),
  };
}

async function fetchEndpoints() {
  const [portals, content] = await Promise.all(
    ['portals', 'content'].map(async (name) => {
      const response = await fetch(`${base}/api/home/${name}`);

      if (!response.ok) {
        throw new Error(`${base}/api/home/${name} answered HTTP ${response.status}.`);
      }

      return response.json();
    }),
  );

  return { portals, content };
}

function readCapture() {
  const captured = JSON.parse(readFileSync(CAPTURE_PATH, 'utf8'));

  console.log(`Capture taken ${captured.capturedAt} from ${captured.base}.`);

  return captured;
}

/** Every path where the two values differ. Object key order is ignored, as jsonb does not keep it. */
function listDifferences(expected, actual, path = '') {
  if (isDeepStrictEqual(expected, actual)) {
    return [];
  }

  const bothObjects = [expected, actual].every((value) => value !== null && typeof value === 'object');

  if (!bothObjects || Array.isArray(expected) !== Array.isArray(actual)) {
    return [`${path || '(value)'}: expected ${preview(expected)}, found ${preview(actual)}`];
  }

  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])];

  return keys.flatMap((key) => listDifferences(expected[key], actual[key], `${path}${Array.isArray(expected) ? `[${key}]` : `.${key}`}`));
}

function preview(value) {
  const text = JSON.stringify(value) ?? 'undefined';

  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function querySupabase(sql) {
  const folder = mkdtempSync(join(tmpdir(), 'home-cutover-'));
  const file = join(folder, 'query.sql');

  try {
    writeFileSync(file, sql);
    // The CLI's own entry point, run by this Node: `npx` is a .cmd file on Windows and needs a shell.
    const output = execFileSync(
      process.execPath,
      [SUPABASE_CLI, 'db', 'query', '--linked', '-f', file],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );

    return JSON.parse(output.slice(output.indexOf('{'))).rows;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

function withNumbers(...columns) {
  return (row) => ({ ...row, ...Object.fromEntries(columns.map((column) => [column, Number(row[column])])) });
}

// SQLite's CURRENT_TIMESTAMP is UTC with no zone; the sync's own values end in `Z`.
function utcMillis(value) {
  const text = String(value).replace(' ', 'T');

  return Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`);
}

function getArg(name) {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}
