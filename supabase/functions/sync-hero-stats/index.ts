import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRecord = Record<string, unknown>;

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await request.json() as { query?: string | number; season?: number };
    const query = String(body.query ?? '').trim();
    const season = Number(body.season);
    if (!query) return json({ error: 'query is required' }, 400);
    if (!Number.isFinite(season) || season < 0 || !Number.isInteger(season * 2)) {
      return json({ error: 'season must be a non-negative whole or half number' }, 400);
    }

    const supabase = createClient(
      requiredEnvironmentValue('SUPABASE_URL'),
      requiredEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const cooldownSeconds = positiveIntegerEnvironmentValue('HERO_STATS_SYNC_COOLDOWN_SECONDS', 300);
    const stored = await loadStoredStats(supabase, query, season, cooldownSeconds);
    if (stored) return json(stored);

    const playerPayload = await fetchRivalsTrackerPlayer(query, season);
    const profilePayload = withoutHeroCollections(playerPayload);
    const playerUid = String(
      playerPayload['uid']
      ?? asRecord(playerPayload['player'])?.['uid']
      ?? query
    );
    const playerName = readString(playerPayload, 'name')
      ?? readString(asRecord(playerPayload['player']), 'name')
      ?? query;
    const now = new Date().toISOString();

    const { data: player, error: playerError } = await supabase
      .from('players')
      .upsert({
        provider: 'rivalstracker',
        provider_player_uid: playerUid,
        player_name: playerName,
        normalized_name: playerName.toLowerCase(),
        updated_at: now,
      }, { onConflict: 'provider,provider_player_uid' })
      .select('id')
      .single();
    if (playerError) throw playerError;

    const { error: profileError } = await supabase
      .from('player_hero_profiles')
      .upsert({
        player_id: player.id,
        season,
        player_payload: profilePayload,
        updated_at: now,
      }, { onConflict: 'player_id,season' });
    if (profileError) throw profileError;

    const ranked = normalizeHeroes(playerPayload['heroes_ranked']);
    const unranked = normalizeHeroes(playerPayload['heroes_unranked']);
    const rows = [
      ...ranked.map(hero => toHeroRow(player.id, season, 'ranked', hero, now)),
      ...unranked.map(hero => toHeroRow(player.id, season, 'unranked', hero, now)),
    ];

    const deleteResult = await supabase
      .from('player_hero_stats')
      .delete()
      .eq('player_id', player.id)
      .eq('season', season);
    if (deleteResult.error) throw deleteResult.error;
    if (rows.length) {
      const { error: statsError } = await supabase.from('player_hero_stats').insert(rows);
      if (statsError) throw statsError;
    }

    const { error: stateError } = await supabase
      .from('hero_stats_sync_state')
      .upsert({
        player_id: player.id,
        season,
        last_synced_at: now,
        last_error: null,
        updated_at: now,
      }, { onConflict: 'player_id,season' });
    if (stateError) throw stateError;

    return json({
      player: {
        ...profilePayload,
        heroes_ranked: ranked,
        heroes_unranked: unranked,
      },
      season,
      source: 'supabase',
      sync_status: 'synced',
    });
  } catch (error) {
    return json({ error: getErrorMessage(error) }, 500);
  }
});

async function loadStoredStats(
  supabase: ReturnType<typeof createClient>,
  query: string,
  season: number,
  cooldownSeconds: number,
): Promise<JsonRecord | null> {
  const player = await findStoredPlayer(supabase, query);
  if (!player) return null;
  const state = await supabase
    .from('hero_stats_sync_state')
    .select('last_synced_at')
    .eq('player_id', player.id)
    .eq('season', season)
    .maybeSingle();
  if (state.error) throw state.error;
  const lastSyncedAt = Date.parse(String(state.data?.last_synced_at ?? ''));
  if (!Number.isFinite(lastSyncedAt)) return null;
  const nextSyncAt = lastSyncedAt + cooldownSeconds * 1000;
  if (Date.now() >= nextSyncAt) return null;

  const profile = await supabase
    .from('player_hero_profiles')
    .select('player_payload')
    .eq('player_id', player.id)
    .eq('season', season)
    .maybeSingle();
  if (profile.error) throw profile.error;
  if (!profile.data) return null;
  const stats = await supabase
    .from('player_hero_stats')
    .select('playlist, stats')
    .eq('player_id', player.id)
    .eq('season', season);
  if (stats.error) throw stats.error;
  const rows = stats.data ?? [];

  return {
    player: {
      ...asRecord(profile.data.player_payload),
      name: readString(asRecord(profile.data.player_payload), 'name') ?? player.player_name,
      uid: asRecord(profile.data.player_payload)?.['uid'] ?? Number(player.provider_player_uid),
      heroes_ranked: rows.filter(row => row.playlist === 'ranked').map(row => row.stats),
      heroes_unranked: rows.filter(row => row.playlist === 'unranked').map(row => row.stats),
    },
    season,
    source: 'supabase',
    sync_status: 'cooldown',
    next_sync_at: new Date(nextSyncAt).toISOString(),
  };
}

async function findStoredPlayer(supabase: ReturnType<typeof createClient>, query: string) {
  const select = 'id, player_name, provider_player_uid';
  const byUid = await supabase.from('players').select(select)
    .in('provider', ['marvelrivalsapi', 'rivalstracker'])
    .eq('provider_player_uid', query).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (byUid.error) throw byUid.error;
  if (byUid.data) return byUid.data;
  const byName = await supabase.from('players').select(select)
    .in('provider', ['marvelrivalsapi', 'rivalstracker'])
    .eq('normalized_name', query.toLowerCase()).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (byName.error) throw byName.error;
  return byName.data;
}

async function fetchRivalsTrackerPlayer(query: string, season: number): Promise<JsonRecord> {
  let uid = query;
  let fallbackName = query;
  if (!/^\d+$/.test(query)) {
    const search = await fetch('https://api.rivalstracker.com/api/find-player', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: query }),
    });
    if (!search.ok) throw new Error(`Rivalstracker search returned ${search.status}`);
    const results = (await search.json() as unknown[]).filter(isRecord);
    const found = results.find(result => readString(result, 'name')?.toLowerCase() === query.toLowerCase()) ?? results[0];
    if (found?.['aid'] === undefined || found?.['aid'] === null) throw new Error(`Rivalstracker found no player for ${query}`);
    uid = String(found['aid']);
    fallbackName = readString(found, 'name') ?? query;
  }

  const providerSeason = Math.round(season * 2);
  const response = await fetch(
    `https://api.rivalstracker.com/api/player/${encodeURIComponent(uid)}?season=${providerSeason}`,
  );
  if (!response.ok) throw new Error(`Rivalstracker player request returned ${response.status}`);
  const payload = asRecord(await response.json());
  const player = asRecord(payload?.['player']);
  const info = asRecord(player?.['info']);
  const name = readString(info, 'name') ?? fallbackName;
  const headIconId = info?.['cur_head_icon_id'];
  return {
    uid: Number(uid),
    name,
    player: {
      uid: Number(uid),
      name,
      level: String(info?.['level'] ?? ''),
      icon: headIconId === undefined ? undefined : {
        player_icon_id: String(headIconId),
        player_icon: `https://rivalstracker.com/images/Playerhead/img_playerhead_${encodeURIComponent(String(headIconId))}.png`,
      },
    },
    heroes_ranked: normalizeHeroes(payload?.['heroes_ranked']),
    heroes_unranked: normalizeHeroes(payload?.['heroes_unranked']),
    updates: {
      info_update_time: typeof player?.['info_update_time'] === 'number'
        ? new Date(Number(player['info_update_time']) * 1000).toISOString()
        : undefined,
    },
  };
}

function normalizeHeroes(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord).map(normalizeHero);
  const record = asRecord(value);
  if (!record) return [];
  return Object.entries(record).flatMap(([heroId, stats]) => {
    const hero = asRecord(stats);
    return hero ? [normalizeHero({ ...hero, hero_id: hero['hero_id'] ?? Number(heroId) })] : [];
  });
}

function normalizeHero(hero: JsonRecord): JsonRecord {
  return { ...hero, wins: hero['wins'] ?? hero['win'] ?? 0 };
}

function toHeroRow(playerId: number, season: number, playlist: string, hero: JsonRecord, now: string) {
  const heroId = typeof hero['hero_id'] === 'number' ? hero['hero_id'] : null;
  const heroName = readString(hero, 'hero_name');
  return {
    player_id: playerId,
    season,
    playlist,
    hero_key: String(heroId ?? heroName ?? crypto.randomUUID()),
    hero_id: heroId,
    hero_name: heroName ?? null,
    hero_type: readString(hero, 'hero_type') ?? null,
    hero_thumbnail: readString(hero, 'hero_thumbnail') ?? null,
    stats: hero,
    updated_at: now,
  };
}

function withoutHeroCollections(player: JsonRecord): JsonRecord {
  // `heroes_ranked`/`heroes_unranked` are normalized and stored separately in
  // `player_hero_stats`, then re-attached to the response below, so they are
  // stripped here to avoid duplicating them inside `player_hero_profiles`.
  // `match_history` is intentionally kept so the client can recover a hero
  // that was genuinely played recently but is missing from the provider's
  // `heroes_ranked`/`heroes_unranked` aggregation (see issue #181).
  const payload = { ...player };
  delete payload['heroes_ranked'];
  delete payload['heroes_unranked'];
  return payload;
}

function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function positiveIntegerEnvironmentValue(name: string, fallback: number): number {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function readString(value: JsonRecord | null, key: string): string | undefined {
  const candidate = value?.[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
}

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const record = asRecord(error);
  return readString(record, 'message') ?? 'Unable to sync hero stats';
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
