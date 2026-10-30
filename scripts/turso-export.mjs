// What the one-off Turso-to-Supabase data migrations share (issues 105 and 106). Each export
// script builds its SQL from Turso with these helpers; `runExport` writes it or checks it.
// Issue 110 deletes this file together with the rest of Turso.
import { readFileSync, writeFileSync } from 'node:fs';

import { createTursoClient } from './turso-client.mjs';

const ROWS_PER_STATEMENT = 25;

// The `external_sources` rows the hero slice copied (issue 105): the hero syncs' snapshots.
export const HERO_SOURCE_KEYS = ['official-heroes', 'fandom-heroes', 'nerfpool-s9-week1'];

export const EXTERNAL_SOURCE_COLUMNS = [
  ['source_key', (row) => text(row.source_key)],
  ['source_name', (row) => text(row.source_name)],
  ['url', (row) => text(row.url)],
  ['payload', (row) => json(row.payload_json)],
  ['fetched_at', (row) => text(row.fetched_at)],
  ['status', (row) => text(row.status)],
  ['error', (row) => text(row.error)],
];

/**
 * `--out <file>` writes the SQL that `buildSql(db)` returns; `--check <file>` exits 1 when Turso
 * has changed since the file was written.
 */
export async function runExport(buildSql) {
  const outPath = getPathArg('--out');
  const checkPath = getPathArg('--check');

  if (Boolean(outPath) === Boolean(checkPath)) {
    console.error('Pass exactly one of --out <file> or --check <file>.');
    process.exit(2);
  }

  const db = createTursoClient();
  let sql;

  try {
    sql = await buildSql(db);
  } finally {
    db.close();
  }

  if (outPath) {
    writeFileSync(outPath, sql);
    console.log(`Wrote ${outPath}.`);
  } else if (readFileSync(checkPath, 'utf8') === sql) {
    console.log('Turso matches the data migration.');
  } else {
    console.error('Turso has changed since the data migration was written. Regenerate it with --out.');
    process.exit(1);
  }
}

export async function select(db, sql, args = []) {
  const result = await db.execute(sql, args);

  return result.rows.map((row) => Object.fromEntries(result.columns.map((column) => [column, row[column]])));
}

/** Inserts that leave an existing row alone, so a re-run never overwrites newer data. */
export function insertStatements(table, columns, rows) {
  const statements = [];

  for (let start = 0; start < rows.length; start += ROWS_PER_STATEMENT) {
    const values = rows
      .slice(start, start + ROWS_PER_STATEMENT)
      .map((row) => `  (${columns.map(([, literal]) => literal(row)).join(', ')})`);

    statements.push(
      `insert into ${table} (${columns.map(([name]) => name).join(', ')}) values\n${values.join(',\n')}\non conflict do nothing;\n`,
    );
  }

  return statements;
}

export function text(value) {
  return value === null || value === undefined ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
}

export function integer(value) {
  if (!Number.isInteger(Number(value))) {
    throw new Error(`Expected an integer but found ${JSON.stringify(value)}.`);
  }

  return String(Number(value));
}

// Throws on malformed JSON here instead of during the push.
export function json(value) {
  JSON.parse(value);

  return `${text(value)}::jsonb`;
}

// SQLite's CURRENT_TIMESTAMP is UTC but carries no zone.
export function utcTimestamp(value) {
  return `'${String(value).replaceAll("'", "''")}+00'::timestamptz`;
}

function getPathArg(name) {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}
