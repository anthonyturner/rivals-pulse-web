import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient } from './turso-client.mjs';

const args = new Set(process.argv.slice(2));
const vercelProductionOnly = args.has('--vercel-production-only');

if (vercelProductionOnly && process.env.VERCEL_ENV !== 'production') {
  console.log(`Skipping missing glossary sync for VERCEL_ENV=${process.env.VERCEL_ENV ?? 'local'}.`);
  process.exit(0);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const glossaryPath = join(projectRoot, 'data', 'seeds', 'glossary.mock.json');
const glossaryTerms = JSON.parse(readFileSync(glossaryPath, 'utf8'));
const db = createTursoClient();

try {
  const existingIds = await getExistingGlossaryIds();
  const missingTerms = glossaryTerms.filter((term) => !existingIds.has(term.id));

  for (const term of missingTerms) {
    await insertGlossaryTerm(term);
  }

  if (missingTerms.length === 0) {
    console.log('No missing glossary terms to sync.');
  } else {
    console.log(`Inserted ${missingTerms.length} missing glossary term(s): ${missingTerms.map((term) => term.term).join(', ')}`);
  }
} finally {
  db.close();
}

async function getExistingGlossaryIds() {
  const result = await db.execute('SELECT id FROM glossary_terms');

  return new Set(result.rows.map((row) => String(row.id)));
}

async function insertGlossaryTerm(term) {
  await db.execute(
    `INSERT INTO glossary_terms (
      id, term, category, definition, coach_note, example, related_terms_json,
      source_name, source_url, raw_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      term.id,
      term.term,
      term.category,
      term.definition,
      term.coachNote,
      term.example,
      JSON.stringify(term.relatedTerms ?? []),
      term.sourceName,
      term.sourceUrl,
      JSON.stringify(term),
    ],
  );
}
