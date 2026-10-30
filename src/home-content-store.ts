import type { SupabaseClient } from '@supabase/supabase-js';

import type { HomeContent, PortalCard } from './app/features/home/home-content.model.js';

// The one place that knows how the home page content is stored in Supabase, shared by the API,
// the home news sync and the seed script. No relative runtime import, for the same reason as
// hero-store.ts.
//
// Neither table is paged: a home page has a handful of portals and one row per content key, far
// below PostgREST's 1000-row response cap.

const PORTAL_TABLE = 'home_portals';
const BLOCK_TABLE = 'home_content_blocks';

/** A content block's key, such as `latestNews`, and the value the API returns under it. */
export type HomeContentBlocks = Partial<Record<keyof HomeContent, unknown>>;

/** The portal cards in their display order. */
export async function listHomePortals(client: SupabaseClient): Promise<PortalCard[]> {
  const { data, error } = await client
    .from(PORTAL_TABLE)
    .select('raw_json')
    .order('sort_order');

  if (error) {
    throw new Error(`Reading home portals failed: ${error.message}`);
  }

  return (data as { raw_json: PortalCard }[]).map((row) => row.raw_json);
}

/**
 * Replaces the portal cards with `portals`, in that order. Each card is written over the one at
 * its position and any card past the end is removed, so a failure part way leaves every position
 * holding a whole card.
 */
export async function replaceHomePortals(
  client: SupabaseClient,
  portals: PortalCard[],
  updatedAt: string,
): Promise<void> {
  const rows = portals.map((portal, index) => ({
    title: portal.title,
    description: portal.description,
    path: portal.path,
    image: portal.image,
    sort_order: index,
    raw_json: portal,
    updated_at: updatedAt,
  }));
  const saved = await client.from(PORTAL_TABLE).upsert(rows, { onConflict: 'sort_order' });

  if (saved.error) {
    throw new Error(`Saving home portals failed: ${saved.error.message}`);
  }

  const trimmed = await client.from(PORTAL_TABLE).delete().gte('sort_order', portals.length);

  if (trimmed.error) {
    throw new Error(`Removing old home portals failed: ${trimmed.error.message}`);
  }
}

/** Every content block, keyed the way `/api/home/content` returns them. */
export async function getHomeContentBlocks(client: SupabaseClient): Promise<HomeContentBlocks> {
  const { data, error } = await client
    .from(BLOCK_TABLE)
    .select('content_key, payload')
    .order('content_key');

  if (error) {
    throw new Error(`Reading home content failed: ${error.message}`);
  }

  return Object.fromEntries(
    (data as { content_key: string; payload: unknown }[]).map((row) => [row.content_key, row.payload]),
  );
}

/** One block's value, or undefined when the block has never been written or is empty. */
export async function getHomeContentBlock<T>(
  client: SupabaseClient,
  contentKey: keyof HomeContent,
): Promise<T | undefined> {
  const { data, error } = await client
    .from(BLOCK_TABLE)
    .select('payload')
    .eq('content_key', contentKey)
    .maybeSingle<{ payload: T | null }>();

  if (error) {
    throw new Error(`Reading home content ${contentKey} failed: ${error.message}`);
  }

  return data?.payload ?? undefined;
}

/** Writes every block in `blocks` in one request, so a sync never leaves half its blocks updated. */
export async function saveHomeContentBlocks(
  client: SupabaseClient,
  blocks: HomeContentBlocks,
  updatedAt: string,
): Promise<void> {
  const rows = Object.entries(blocks).map(([contentKey, payload]) => ({
    content_key: contentKey,
    payload: payload ?? null,
    updated_at: updatedAt,
  }));
  const { error } = await client.from(BLOCK_TABLE).upsert(rows, { onConflict: 'content_key' });

  if (error) {
    throw new Error(`Saving home content failed: ${error.message}`);
  }
}

export async function countHomePortals(client: SupabaseClient): Promise<number> {
  return countRows(client, PORTAL_TABLE);
}

export async function countHomeContentBlocks(client: SupabaseClient): Promise<number> {
  return countRows(client, BLOCK_TABLE);
}

async function countRows(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Counting ${table} failed: ${error.message}`);
  }

  return count ?? 0;
}
