import { readFileSync } from 'node:fs';

/** The migrations folder; this repo has no database to run them in, so tests read the SQL instead. */
export const MIGRATIONS = new URL('../../migrations/', import.meta.url);

export const read = (name: string): string => readFileSync(new URL(name, MIGRATIONS), 'utf8');

export const withoutComments = (sql: string): string => sql.replace(/--.*$/gm, '');

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function createdTables(sql: string): string[] {
  return [...withoutComments(sql).matchAll(/create table if not exists (public\.\w+)/g)].map(match => match[1]);
}

/** Each created function as `public.name(type, type)`, the form `revoke` and `grant` name it by. */
export function createdFunctions(sql: string): string[] {
  return [...withoutComments(sql).matchAll(/create or replace function (public\.\w+)\(([^)]*)\)/g)].map(match => {
    const types = match[2].split(',').map(argument => argument.trim().split(/\s+/)[1]).filter(Boolean);
    return `${match[1]}(${types.join(', ')})`;
  });
}

/** The column names of a created table: every line before its first key or constraint. */
export function columnsOf(sql: string, table: string): string[] {
  const body = withoutComments(sql).match(new RegExp(`create table if not exists ${table} \\(([\\s\\S]*?)\\n\\);`))?.[1] ?? '';
  const words = body.split('\n').map(line => line.trim().split(/\s+/)[0]);
  const end = words.findIndex(word => ['primary', 'constraint', 'unique', 'check'].includes(word));
  return words.slice(0, end < 0 ? undefined : end).filter(word => /^[a-z_]+$/.test(word));
}
