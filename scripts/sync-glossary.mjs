// Copies glossary terms from data/seeds/glossary.mock.json into Supabase.
//
//   npm run sync:glossary                            every term, replacing stored ones
//   npm run sync:glossary:missing                    only terms not stored yet
//   npm run sync:glossary:terms -- <id-or-term>...   only the named terms
//
// `--vercel-production-only` (the production build step) skips the run on any other deployment.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { listGlossaryTermIds, saveGlossaryTerms } from '../src/glossary-store.ts';
import { finishSyncRun, startSyncRun } from '../src/sync-log.ts';
import { getSupabaseClient } from './supabase-client.mjs';

const args = process.argv.slice(2);
const flags = new Set(args.filter((arg) => arg.startsWith('--')));
const requested = args.filter((arg) => !arg.startsWith('--')).map(normalizeLookupValue);
const mode = flags.has('--missing') ? 'missing' : flags.has('--terms') ? 'terms' : 'all';

if (flags.has('--vercel-production-only') && process.env.VERCEL_ENV !== 'production') {
  console.log(`Skipping the glossary sync for VERCEL_ENV=${process.env.VERCEL_ENV ?? 'local'}.`);
  process.exit(0);
}

if (mode === 'terms' && requested.length === 0) {
  console.error('Usage: npm run sync:glossary:terms -- <term-or-id> [term-or-id...]');
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const glossaryPath = join(__dirname, '..', 'data', 'seeds', 'glossary.mock.json');
const glossaryTerms = JSON.parse(readFileSync(glossaryPath, 'utf8'));
const unknown = requested.filter((value) => !glossaryTerms.some((term) => matches(term, value)));

if (unknown.length > 0) {
  console.error(`Could not find glossary term(s): ${unknown.join(', ')}`);
  process.exit(1);
}

const db = getSupabaseClient();
const runId = await startSyncRun(db, 'glossary', `Syncing glossary terms (${mode})`);

try {
  const terms = await selectTerms();

  await saveGlossaryTerms(db, terms);

  const message = terms.length === 0
    ? 'No glossary terms to sync.'
    : `Synced ${terms.length} glossary term(s): ${terms.map((term) => term.term).join(', ')}`;

  await finishSyncRun(db, runId, {
    status: 'success',
    message,
    details: { mode, saved: terms.map((term) => term.id) },
  });
  console.log(message);
} catch (error) {
  await finishSyncRun(db, runId, {
    status: 'error',
    message: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

async function selectTerms() {
  if (mode === 'terms') {
    return glossaryTerms.filter((term) => requested.some((value) => matches(term, value)));
  }

  if (mode === 'missing') {
    const storedIds = await listGlossaryTermIds(db);

    return glossaryTerms.filter((term) => !storedIds.has(term.id));
  }

  return glossaryTerms;
}

function matches(term, value) {
  return normalizeLookupValue(term.id) === value || normalizeLookupValue(term.term) === value;
}

function normalizeLookupValue(value) {
  return value.trim().toLowerCase();
}
