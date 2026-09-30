import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const glossaryPath = join(projectRoot, 'data', 'seeds', 'glossary.mock.json');
const requestedTerms = process.argv.slice(2).map((value) => normalizeLookupValue(value));

if (requestedTerms.length === 0) {
  console.error('Usage: npm run sync:glossary:terms -- <term-or-id> [term-or-id...]');
  process.exit(1);
}

const glossaryTerms = JSON.parse(readFileSync(glossaryPath, 'utf8'));
const selectedTerms = glossaryTerms.filter((term) =>
  requestedTerms.includes(normalizeLookupValue(term.id)) ||
  requestedTerms.includes(normalizeLookupValue(term.term)),
);
const missingTerms = requestedTerms.filter((requestedTerm) =>
  !selectedTerms.some((term) =>
    normalizeLookupValue(term.id) === requestedTerm ||
    normalizeLookupValue(term.term) === requestedTerm,
  ),
);

if (missingTerms.length > 0) {
  console.error(`Could not find glossary term(s): ${missingTerms.join(', ')}`);
  process.exit(1);
}

const db = createTursoClient();

try {
  for (const term of selectedTerms) {
    await upsertGlossaryTerm(term);
  }

  console.log(`Synced ${selectedTerms.length} glossary term(s): ${selectedTerms.map((term) => term.term).join(', ')}`);
} finally {
  db.close();
}

async function upsertGlossaryTerm(term) {
  await db.execute(
    `INSERT INTO glossary_terms (
      id, term, category, definition, coach_note, example, related_terms_json,
      source_name, source_url, raw_json, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      term = excluded.term,
      category = excluded.category,
      definition = excluded.definition,
      coach_note = excluded.coach_note,
      example = excluded.example,
      related_terms_json = excluded.related_terms_json,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      raw_json = excluded.raw_json,
      updated_at = CURRENT_TIMESTAMP`,
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

function normalizeLookupValue(value) {
  return value.trim().toLowerCase();
}
