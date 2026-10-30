// Proves the reference content (issue 106) reached Supabase intact. Issue 110 deletes this file
// together with the rest of Turso.
//
//   node scripts/verify-reference-content.mjs
//     After `npx supabase db push`: row counts and every row against Turso (five named rows per
//     table are printed), RLS on, no policy and no grant to `anon` or `authenticated` on the new
//     table, and the endpoint JSON the new readers will serve, rebuilt from Supabase, against the
//     captures taken before the cutover.
//
//   node scripts/verify-reference-content.mjs --endpoints https://marvel-rivals-coach-six.vercel.app
//     After the merge deploys: the live endpoints against the same captures.
//
//   node scripts/verify-reference-content.mjs sync-run
//     After each writer has run once: the latest `sync_runs` row of every writer in this slice
//     (the glossary sync, the hero video sync and each `db:sync` source) is a success.
//
// Reads Supabase through the linked CLI (`npx supabase link` once per machine), so it needs no
// service key; reads Turso through TURSO_* in .env. Exits 1 on any difference.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient } from './turso-client.mjs';
import { selectRows } from './turso-data-migration.mjs';

const capturesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'turso-cutover', '106');
const SERVED_VIDEO_TYPES = ['paz-gameplay', 'paz-counters-combos'];
const SOURCE_KEYS = [
  'fandom-battlepasses',
  'fandom-deadpool',
  'fandom-deadpool-abilities-template',
  'fandom-heroes',
  'nerfpool-s9-week1',
  'official-heroes',
  'official-marvel-rivals-home',
  'steam-marvel-rivals-news',
];
// Sources the hero slice (issue 105) and the home slice (issue 107) copied. Their syncs already
// write them to Supabase, so a difference means a sync has run since: it is listed, not failed.
const OTHER_SLICE_SOURCE_KEYS = [
  'official-heroes',
  'fandom-heroes',
  'nerfpool-s9-week1',
  'official-marvel-rivals-home',
];
// The `sync_runs.source_key` each writer of this slice records.
const SYNC_RUN_KEYS = [
  'glossary',
  'hero-videos',
  'fandom-battlepasses',
  'fandom-deadpool',
  'fandom-deadpool-abilities-template',
];
// Every table privilege Postgres has. The project's default privileges grant all of them to `anon`
// and `authenticated` on any new table in `public`, so the migration's `revoke all` is the only
// thing keeping the publishable key out.
const TABLE_PRIVILEGES = ['select', 'insert', 'update', 'delete', 'truncate', 'references', 'trigger'];
const SEQUENCE_PRIVILEGES = ['usage', 'select', 'update'];
const PUBLIC_ROLES = ['anon', 'authenticated'];
const NAMED = {
  glossary_terms: ['afk', 'anchor-hero', 'choke-point', 'mvp-svp', 'team-up'],
  hero_videos: [
    'hero:adam-warlock:paz-gameplay',
    'hero:cloak-and-dagger:paz-counters-combos',
    'hero:jeff-the-land-shark:paz-gameplay',
    'role:Vanguard:paz-gameplay',
    'role:Multi-Role:paz-counters-combos',
  ],
  external_sources: [
    'fandom-battlepasses',
    'fandom-deadpool',
    'fandom-deadpool-abilities-template',
    'steam-marvel-rivals-news',
    'fandom-heroes',
  ],
};

const failures = [];
const notes = [];
const endpointsIndex = process.argv.indexOf('--endpoints');

if (process.argv[2] === 'sync-run') {
  verifySyncRuns();
} else if (endpointsIndex !== -1) {
  await verifyEndpoints(process.argv[endpointsIndex + 1]?.replace(/\/$/, ''));
} else if (process.argv[2] === undefined) {
  await verifyDatabase();
} else {
  console.error(`Unknown argument "${process.argv[2]}". Pass nothing, sync-run or --endpoints <url>.`);
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

async function verifyDatabase() {
  const turso = await readTurso();
  const supabase = readSupabase();

  compareTable('glossary_terms', turso.glossary, supabase.glossary, (row) => row.id, normalizeGlossaryRow);
  compareTable('hero_videos', turso.videos, supabase.videos, videoKey, normalizeVideoRow);
  compareTable('external_sources', turso.sources, supabase.sources, (row) => row.source_key, normalizeSourceRow);

  check('glossary_terms has RLS on', supabase.rls.relrowsecurity === true, JSON.stringify(supabase.rls));
  check('glossary_terms has no policy', Number(supabase.rls.policies) === 0, JSON.stringify(supabase.rls));
  verifyNoPublicGrants('glossary_terms');

  // What the new readers will return, rebuilt with the same filters and order.
  compareCapture('/api/glossary', supabase.glossary.map((row) => row.raw_json), 'glossary.json');
  compareCapture('/api/hero-videos', supabase.videos.map(toHeroVideo), 'hero-videos.json');

  for (const key of SOURCE_KEYS) {
    const row = supabase.sources.find((source) => source.source_key === key);

    compareCapture(`/api/external-sources/${key}`, row?.payload, `external-sources-${key}.json`);
  }

  compareStatusCounts({
    glossaryTerms: supabase.glossary.length,
    externalSources: supabase.sources.length,
    heroVideos: supabase.videos.length,
  });
}

// Fails on any privilege `anon` or `authenticated` holds on the table or on a sequence it owns.
function verifyNoPublicGrants(table) {
  const quote = (values) => values.map((value) => `'${value}'`).join(', ');
  const rows = querySupabase(`
    with target as (select 'public.${table}'::regclass as oid),
    sequences as (
      select d.objid as oid
      from pg_depend d join pg_class s on s.oid = d.objid, target
      where d.classid = 'pg_class'::regclass and d.refobjid = target.oid
        and d.deptype in ('a', 'i') and s.relkind = 'S'
    )
    select 'table' as kind, target.oid::regclass::text as name, r.role, p.privilege,
      has_table_privilege(r.role, target.oid, p.privilege) as granted
    from target, unnest(array[${quote(PUBLIC_ROLES)}]) as r(role),
      unnest(array[${quote(TABLE_PRIVILEGES)}]) as p(privilege)
    union all
    select 'sequence', s.oid::regclass::text, r.role, p.privilege,
      has_sequence_privilege(r.role, s.oid, p.privilege)
    from sequences s, unnest(array[${quote(PUBLIC_ROLES)}]) as r(role),
      unnest(array[${quote(SEQUENCE_PRIVILEGES)}]) as p(privilege)`);
  const expected = PUBLIC_ROLES.length * TABLE_PRIVILEGES.length;
  const checked = rows.filter((row) => row.kind === 'table').length;
  const sequences = [...new Set(rows.filter((row) => row.kind === 'sequence').map((row) => row.name))];
  const granted = rows.filter((row) => row.granted !== false);

  check(`${table} privileges checked`, checked === expected, `${checked} of ${expected} came back`);
  check(
    `${table} grants nothing to ${PUBLIC_ROLES.join(' or ')} ` +
      `(${TABLE_PRIVILEGES.join(', ')}; owned sequences: ${sequences.join(', ') || 'none'})`,
    granted.length === 0,
    granted.map((row) => `${row.role} has ${row.privilege} on ${row.kind} ${row.name}`).join('; '),
  );
}

function verifySyncRuns() {
  const rows = querySupabase(`
    select distinct on (source_key) source_key, id, status, message, started_at, finished_at
    from public.sync_runs
    where source_key in (${SYNC_RUN_KEYS.map((key) => `'${key}'`).join(', ')})
    order by source_key, started_at desc`);

  for (const key of SYNC_RUN_KEYS) {
    const run = rows.find((row) => row.source_key === key);

    check(`latest ${key} run is a success`, run?.status === 'success', `latest: ${JSON.stringify(run ?? null)}`);

    if (run?.status === 'success') {
      console.log(`  run ${run.id}: "${run.message}", started ${run.started_at}`);
    }
  }
}

async function verifyEndpoints(baseUrl) {
  if (!baseUrl) {
    console.error('Pass the deployment, e.g. --endpoints https://marvel-rivals-coach-six.vercel.app');
    process.exit(2);
  }

  compareCapture('/api/glossary', await getJson(`${baseUrl}/api/glossary`), 'glossary.json');
  compareCapture('/api/hero-videos', await getJson(`${baseUrl}/api/hero-videos`), 'hero-videos.json');

  for (const key of SOURCE_KEYS) {
    const path = `/api/external-sources/${key}`;

    compareCapture(path, await getJson(`${baseUrl}${path}`), `external-sources-${key}.json`);
  }

  const missing = await fetch(`${baseUrl}/api/external-sources/no-such-source`);

  check('/api/external-sources/no-such-source is 404', missing.status === 404, `status ${missing.status}`);

  const status = await getJson(`${baseUrl}/api/content/status`);

  compareStatusCounts(status);
}

async function readTurso() {
  const db = createTursoClient();

  try {
    return {
      glossary: await selectRows(db, 'SELECT * FROM glossary_terms'),
      videos: await selectRows(db, 'SELECT * FROM hero_videos'),
      sources: await selectRows(db, 'SELECT * FROM external_sources'),
    };
  } finally {
    db.close();
  }
}

function readSupabase() {
  const served = SERVED_VIDEO_TYPES.map((type) => `'${type}'`).join(', ');

  return {
    glossary: querySupabase('select * from public.glossary_terms order by term_sort_key, id'),
    videos: querySupabase(
      `select * from public.hero_videos where video_type in (${served}) order by sort_order, source_key`,
    ),
    sources: querySupabase('select * from public.external_sources order by source_key'),
    rls: querySupabase(`
      select c.relrowsecurity,
        (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = 'glossary_terms') as policies
      from pg_class c
      where c.oid = 'public.glossary_terms'::regclass`)[0],
  };
}

// The CLI sometimes fails or stalls while it sets up its login role, so a query gets three tries.
function querySupabase(sql, attempts = 3) {
  const cli = join(dirname(createRequire(import.meta.url).resolve('supabase/package.json')), 'dist', 'supabase.js');
  const dir = mkdtempSync(join(tmpdir(), 'verify-reference-'));
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
        throw new Error(`supabase db query failed: ${result.error?.message ?? ''} ${result.stderr}`);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function compareTable(table, tursoRows, supabaseRows, keyOf, normalize) {
  check(
    `${table} row count`,
    tursoRows.length === supabaseRows.length,
    `Turso ${tursoRows.length}, Supabase ${supabaseRows.length}`,
  );

  const stored = new Map(supabaseRows.map((row) => [keyOf(row), normalize(row)]));
  let equal = 0;

  for (const row of tursoRows) {
    const key = keyOf(row);
    const differences = diff(normalize(row), stored.get(key));

    if (differences.length === 0) {
      equal += 1;
    } else if (table === 'external_sources' && OTHER_SLICE_SOURCE_KEYS.includes(key)) {
      notes.push(`${table} ${key} differs from Turso (its sync has run since): ${differences.join('; ')}`);
    } else {
      failures.push(`${table} ${key}: ${differences.join('; ')}`);
    }
  }

  console.log(`${table}: ${equal} of ${tursoRows.length} Turso rows equal in Supabase.`);

  for (const key of NAMED[table]) {
    const row = tursoRows.find((candidate) => keyOf(candidate) === key);
    const same = row !== undefined && diff(normalize(row), stored.get(key)).length === 0;

    console.log(`  ${same ? 'equal' : 'DIFFERENT'}  ${key}`);
  }
}

function compareCapture(label, actual, captureFile) {
  const expected = JSON.parse(readFileSync(join(capturesDir, captureFile), 'utf8'));
  const differences = diff(expected, actual);
  const otherSlice = OTHER_SLICE_SOURCE_KEYS.some((key) => label.endsWith(`/${key}`));

  if (differences.length === 0) {
    console.log(`${label}: equal to the capture.`);
  } else if (otherSlice) {
    notes.push(`${label} differs from the capture (its sync has run since): ${differences.join('; ')}`);
  } else {
    failures.push(`${label}: ${differences.join('; ')}`);
  }
}

function compareStatusCounts(actual) {
  const expected = JSON.parse(readFileSync(join(capturesDir, 'content-status.json'), 'utf8'));

  for (const field of ['glossaryTerms', 'externalSources', 'heroVideos']) {
    check(`/api/content/status ${field}`, actual[field] === expected[field], `capture ${expected[field]}, now ${actual[field]}`);
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

function videoKey(row) {
  return row.hero_id ? `hero:${row.hero_id}:${row.video_type}` : `role:${row.role}:${row.video_type}`;
}

function toHeroVideo(row) {
  return {
    heroId: row.hero_id,
    role: row.role,
    videoType: row.video_type,
    youtubeId: row.youtube_id,
    title: row.title,
  };
}

// Turso keeps JSON as text and timestamps as zoneless UTC text; Supabase has jsonb and timestamptz.
function normalizeGlossaryRow(row) {
  return {
    id: row.id,
    term: row.term,
    category: row.category,
    definition: row.definition,
    coach_note: row.coach_note,
    example: row.example,
    related_terms: row.related_terms ?? parseJson(row.related_terms_json),
    source_name: row.source_name,
    source_url: row.source_url,
    raw_json: parseJson(row.raw_json),
    updated_at: instant(row.updated_at),
  };
}

// Supabase's own ids, timestamps and source keys predate this move, so only the content compares.
function normalizeVideoRow(row) {
  return { ...toHeroVideo(row), sort_order: Number(row.sort_order) };
}

function normalizeSourceRow(row) {
  return {
    source_key: row.source_key,
    source_name: row.source_name,
    url: row.url,
    payload: row.payload ?? parseJson(row.payload_json),
    fetched_at: instant(row.fetched_at),
    status: row.status,
    error: row.error,
  };
}

function parseJson(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function instant(value) {
  const text = String(value).replace(' ', 'T');
  const zoned = /([zZ]|[+-]\d\d(:?\d\d)?)$/.test(text) ? text.replace(/([+-]\d\d)$/, '$1:00') : `${text}Z`;

  return new Date(zoned).toISOString();
}

async function getJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    failures.push(`${url} answered ${response.status}`);

    return undefined;
  }

  return response.json();
}
