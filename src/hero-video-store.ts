import type { SupabaseClient } from '@supabase/supabase-js';

import type { HeroRole, HeroVideo, HeroVideoType } from './app/features/heroes/hero.model.js';

// The one place that knows how hero videos are stored in Supabase, shared by the API and the
// hero video sync. No relative runtime import, for the same reason as hero-store.ts.

const VIDEO_TABLE = 'hero_videos';

// The table also holds the Gefest role guides, which the heroes page still hard-codes. Serving them
// would change what /api/hero-videos returns, so the website reads and writes only these types.
const SERVED_VIDEO_TYPES: readonly HeroVideoType[] = ['paz-gameplay', 'paz-counters-combos'];

// PostgREST answers with at most 1000 rows per request.
const PAGE_SIZE = 500;

/** One entry of `data/seeds/hero-videos.mock.json`: a hero's video, or a role's fallback video. */
export interface HeroVideoEntry {
  heroId?: string | null;
  role?: HeroRole | null;
  videoType: HeroVideoType;
  /** The YouTube id. */
  id: string;
  title: string;
}

interface HeroVideoRow {
  hero_id: string | null;
  role: HeroRole | null;
  video_type: HeroVideoType;
  youtube_id: string;
  title: string;
}

/** Every video, in the order of the seed file it was saved from. */
export async function listHeroVideos(client: SupabaseClient): Promise<HeroVideo[]> {
  const rows = await readAllPages<HeroVideoRow>(client, 'hero_id, role, video_type, youtube_id, title');

  return rows.map((row) => ({
    heroId: row.hero_id,
    role: row.role,
    videoType: row.video_type,
    youtubeId: row.youtube_id,
    title: row.title,
  }));
}

export async function countHeroVideos(client: SupabaseClient): Promise<number> {
  const { count, error } = await client
    .from(VIDEO_TABLE)
    .select('*', { count: 'exact', head: true })
    .in('video_type', SERVED_VIDEO_TYPES);

  if (error) {
    throw new Error(`Counting hero videos failed: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Makes the stored videos match `entries`: each is saved at its position in the list, and a stored
 * video that is no longer listed is removed. Returns the keys of the removed videos.
 */
export async function saveHeroVideos(
  client: SupabaseClient,
  entries: readonly HeroVideoEntry[],
): Promise<string[]> {
  const updatedAt = new Date().toISOString();
  const rows = entries.map((entry, index) => ({
    source_key: heroVideoSourceKey(entry),
    hero_id: entry.heroId ?? null,
    role: entry.role ?? null,
    video_type: entry.videoType,
    youtube_id: entry.id,
    title: entry.title,
    sort_order: index,
    updated_at: updatedAt,
  }));

  for (let start = 0; start < rows.length; start += PAGE_SIZE) {
    const { error } = await client
      .from(VIDEO_TABLE)
      .upsert(rows.slice(start, start + PAGE_SIZE), { onConflict: 'source_key' });

    if (error) {
      throw new Error(`Saving hero videos failed: ${error.message}`);
    }
  }

  const listed = new Set(rows.map((row) => row.source_key));
  const stored = await readAllPages<{ source_key: string }>(client, 'source_key');
  const removed = stored.map((row) => row.source_key).filter((key) => !listed.has(key));

  if (removed.length > 0) {
    const { error } = await client.from(VIDEO_TABLE).delete().in('source_key', removed);

    if (error) {
      throw new Error(`Removing unlisted hero videos failed: ${error.message}`);
    }
  }

  return removed;
}

/** The table's unique key: `hero:<hero id>:<type>` or `role:<role>:<type>`. */
export function heroVideoSourceKey(entry: HeroVideoEntry): string {
  return entry.heroId
    ? `hero:${entry.heroId}:${entry.videoType}`
    : `role:${entry.role}:${entry.videoType}`;
}

async function readAllPages<T>(client: SupabaseClient, columns: string): Promise<T[]> {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    // The seed position is unique, so `sort_order` alone fixes the order; the key is a safety net
    // that keeps paging stable if two rows ever share a position.
    const { data, error } = await client
      .from(VIDEO_TABLE)
      .select(columns)
      .in('video_type', SERVED_VIDEO_TYPES)
      .order('sort_order')
      .order('source_key')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Reading hero videos failed: ${error.message}`);
    }

    rows.push(...(data as T[]));

    if (data.length < PAGE_SIZE) {
      return rows;
    }
  }
}
