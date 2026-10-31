// The Turso part of `npm run db:seed`. Every seeded table has moved to Supabase, so this only
// applies the schema of the tables still in Turso (sync runs, tier list). Issue 110
// deletes it with Turso.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTursoClient, executeSchema } from './turso-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'sqlite-schema.sql');

const db = createTursoClient();

try {
  await executeSchema(db, readFileSync(schemaPath, 'utf8'));
  console.log('Applied the Turso schema.');
} finally {
  db.close();
}
