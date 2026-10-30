// Proves the reference content (issue 106) reached Supabase intact. Issue 110 deletes this file
// together with the rest of Turso.
//
//   node scripts/verify-reference-content.mjs
//     After `npx supabase db push`: row counts and every row against Turso (five named rows per
//     table are printed), RLS on the new table, and the endpoint JSON the new readers will serve,
//     rebuilt from Supabase, against the captures taken before the cutover.
//
//   node scripts/verify-reference-content.mjs --endpoints https://marvel-rivals-coach-six.vercel.app
//     After the merge deploys: the live endpoints against the same captures.
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
import { select } from './turso-export.mjs';

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
// Since issue 105 the hero syncs write these to Supabase while production still reads Turso, so a
// difference here means the hero syncs have run since. It is listed, not failed.
const HERO_SOURCE_KEYS = ['official-heroes', 'fandom-heroes', 'nerfpool-s9-week1'];
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
    'official-marvel-rivals-home',
    'steam-marvel-rivals-news',
  ],
};

const failures = [];
const notes = [];
const endpointsIndex = process.argv.indexOf('--endpoints');

if (endpointsIndex === -1) {
  await verifyDatabase();
} else {
  await verifyEndpoints(process.argv[endpointsIndex + 1]?.replace(/\/$/, ''));
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
  compareTable(
    'external_sources',
    turso.sources.filter((row) => !HERO_SOURCE_KEYS.includes(row.source_key)),
    supabase.sources.filter((row) => !HERO_SOURCE_KEYS.includes(row.source_key)),
    (row) => row.source_key,
    normalizeSourceRow,
  );
  check(
    'external_sources row count',
    supabase.sources.length === turso.sources.length,
    `Turso ${turso.sources.length}, Supabase ${supabase.sources.length}`,
  );

  check('glossary_terms has RLS on', supabase.rls.relrowsecurity === true, JSON.stringify(supabase.rls));
  check('glossary_terms has no policy', Number(supabase.rls.policies) === 0, JSON.stringify(supabase.rls));

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
      glossary: await select(db, 'SELECT * FROM glossary_terms'),
      videos: await select(db, 'SELECT * FROM hero_videos'),
      sources: await select(db, 'SELECT * FROM external_sources'),
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
  const heroSource = HERO_SOURCE_KEYS.some((key) => label.endsWith(`/${key}`));

  if (differences.length === 0) {
    console.log(`${label}: equal to the capture.`);
  } else if (heroSource) {
    notes.push(`${label} differs from the capture (the hero syncs have run since): ${differences.join('; ')}`);
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
