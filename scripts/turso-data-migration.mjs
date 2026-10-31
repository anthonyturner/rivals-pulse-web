// Shared by the one-off scripts that copy a Turso domain into Supabase as a data migration
// (`export-turso-*.mjs`). Each script builds its SQL and hands it to `writeOrCheckDataMigration`.
// Issue 110 deletes this file together with the rest of Turso.
import { readFileSync, writeFileSync } from 'node:fs';

const ROWS_PER_STATEMENT = 25;

/**
 * `--out <file>` writes the SQL; `--check <file>` exits 1 when Turso no longer matches the file, so
 * it can run just before `npx supabase db push`.
 */
export async function writeOrCheckDataMigration(buildSql) {
  const outPath = getPathArg('--out');
  const checkPath = getPathArg('--check');

  if (Boolean(outPath) === Boolean(checkPath)) {
    console.error('Pass exactly one of --out <file> or --check <file>.');
    process.exit(2);
  }

  const sql = await buildSql();

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

export async function selectRows(db, sql, args = []) {
  const result = await db.execute(sql, args);

  return result.rows.map((row) => Object.fromEntries(result.columns.map((column) => [column, row[column]])));
}

/** `columns` is a list of `[name, (row) => sqlLiteral]`. Every insert skips rows that exist. */
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

// SQLite's CURRENT_TIMESTAMP is UTC but carries no zone; values a sync wrote with
// `new Date().toISOString()` already end in `Z`.
export function utcTimestamp(value) {
  const zone = /(Z|[+-]\d{2}:?\d{2})$/.test(String(value)) ? '' : '+00';

  return `'${String(value).replaceAll("'", "''")}${zone}'::timestamptz`;
}

function getPathArg(name) {
  const index = process.argv.indexOf(name);

  return index === -1 ? undefined : process.argv[index + 1];
}
