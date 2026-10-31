import type { SupabaseClient } from '@supabase/supabase-js';

import type { Hero } from './app/features/heroes/hero.model.js';

// The one place that knows how heroes are stored in Supabase, shared by the API and the sync
// scripts. It has no relative runtime import on purpose: the scripts load it straight through
// Node's type stripping, which cannot resolve the `.js` specifiers the API code uses.

const HERO_TABLE = 'hero_content';

// PostgREST answers with at most 1000 rows per request; a page well below that keeps each
// response small.
const PAGE_SIZE = 500;

interface HeroRow {
  id: string;
  name: string;
  role: string;
  raw_json: Hero;
}

async function readAllRows<Row>(client: SupabaseClient, columns: string, failure: string): Promise<Row[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    // Paging needs a stable order; any display order is applied by the caller.
    const { data, error } = await client
      .from(HERO_TABLE)
      .select(columns)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`${failure}: ${error.message}`);
    }

    rows.push(...(data as Row[]));

    if (data.length < PAGE_SIZE) {
      return rows;
    }
  }
}

/** Every hero, ordered by name ignoring case. */
export async function listHeroes(client: SupabaseClient): Promise<Hero[]> {
  const rows = await readAllRows<HeroRow>(client, 'id, name, raw_json', 'Reading heroes failed');

  return rows.sort(compareHeroRows).map((row) => row.raw_json);
}

/** Each hero's role (`Vanguard`, `Duelist` or `Strategist`) by hero id, for the numbers split by role. */
export async function listHeroRoles(client: SupabaseClient): Promise<ReadonlyMap<string, string>> {
  const rows = await readAllRows<Pick<HeroRow, 'id' | 'role'>>(client, 'id, role', 'Reading hero roles failed');

  return new Map(rows.map((row) => [row.id, row.role]));
}

export async function getHero(client: SupabaseClient, id: string): Promise<Hero | undefined> {
  const { data, error } = await client
    .from(HERO_TABLE)
    .select('raw_json')
    .eq('id', id)
    .maybeSingle<Pick<HeroRow, 'raw_json'>>();

  if (error) {
    throw new Error(`Reading hero ${id} failed: ${error.message}`);
  }

  return data?.raw_json;
}

export async function countHeroes(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from(HERO_TABLE)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Counting heroes failed: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Stores a hero, replacing its list items and abilities from the same record in one transaction
 * (the `save_hero` database function). A hero without an `id` is refused by the database.
 */
export async function saveHero(client: SupabaseClient, hero: Hero): Promise<void> {
  const { error } = await client.rpc('save_hero', { p_hero: hero });

  if (error) {
    throw new Error(`Saving hero ${hero.id} failed: ${error.message}`);
  }
}

/** Removes a hero; its list items and abilities go with it. A hero that is not there is fine. */
export async function deleteHero(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from(HERO_TABLE).delete().eq('id', id);

  if (error) {
    throw new Error(`Deleting hero ${id} failed: ${error.message}`);
  }
}

/**
 * Orders names the way SQLite's `COLLATE NOCASE` did, which the endpoints used before the move:
 * only A-Z fold to lower case, and the rest compares by character code. The database's own
 * collation would order punctuation and accents differently.
 */
export function compareHeroRows(
  left: Pick<HeroRow, 'id' | 'name'>,
  right: Pick<HeroRow, 'id' | 'name'>,
): number {
  return compareText(foldAscii(left.name), foldAscii(right.name)) || compareText(left.id, right.id);
}

function foldAscii(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
