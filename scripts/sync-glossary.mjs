import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const glossaryPath = join(projectRoot, 'data', 'seeds', 'glossary.mock.json');
const glossaryTerms = JSON.parse(readFileSync(glossaryPath, 'utf8'));
const db = createTursoClient();

try {
  for (const term of glossaryTerms) {
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

  console.log(`Synced ${glossaryTerms.length} glossary terms.`);
} finally {
  db.close();
}
