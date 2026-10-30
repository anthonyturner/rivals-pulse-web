import type { SupabaseClient } from '@supabase/supabase-js';

import type { GlossaryTerm } from './app/features/reference/glossary/glossary.model.js';

// The one place that knows how glossary terms are stored in Supabase, shared by the API and the
// glossary sync. No relative runtime import, for the same reason as hero-store.ts.

const GLOSSARY_TABLE = 'glossary_terms';

// PostgREST answers with at most 1000 rows per request.
const PAGE_SIZE = 500;

/** Every term, ordered by term ignoring case. */
export async function listGlossaryTerms(client: SupabaseClient): Promise<GlossaryTerm[]> {
  const rows = await readAllPages<{ raw_json: GlossaryTerm }>(client, 'raw_json');

  return rows.map((row) => row.raw_json);
}

export async function listGlossaryTermIds(client: SupabaseClient): Promise<Set<string>> {
  const rows = await readAllPages<{ id: string }>(client, 'id');

  return new Set(rows.map((row) => row.id));
}

export async function countGlossaryTerms(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from(GLOSSARY_TABLE)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Counting glossary terms failed: ${error.message}`);
  }

  return count ?? 0;
}

/** Inserts the terms, replacing any stored term with the same id. */
export async function saveGlossaryTerms(
  client: SupabaseClient,
  terms: readonly GlossaryTerm[],
): Promise<void> {
  if (terms.length === 0) {
    return;
  }

  const updatedAt = new Date().toISOString();

  for (let start = 0; start < terms.length; start += PAGE_SIZE) {
    const rows = terms.slice(start, start + PAGE_SIZE).map((term) => toRow(term, updatedAt));
    const { error } = await client.from(GLOSSARY_TABLE).upsert(rows, { onConflict: 'id' });

    if (error) {
      throw new Error(`Saving glossary terms failed: ${error.message}`);
    }
  }
}

async function readAllPages<T>(client: SupabaseClient, columns: string): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    // `term_sort_key` is the term folded the way SQLite's `COLLATE NOCASE` did; the id makes the
    // order total, which paging needs.
    const { data, error } = await client
      .from(GLOSSARY_TABLE)
      .select(columns)
      .order('term_sort_key')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Reading glossary terms failed: ${error.message}`);
    }

    rows.push(...(data as T[]));

    if (data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

function toRow(term: GlossaryTerm, updatedAt: string) {
  return {
    id: term.id,
    term: term.term,
    category: term.category,
    definition: term.definition,
    coach_note: term.coachNote,
    example: term.example,
    related_terms: term.relatedTerms ?? [],
    source_name: term.sourceName,
    source_url: term.sourceUrl,
    raw_json: term,
    updated_at: updatedAt,
  };
}
