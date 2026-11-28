import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type JsonRecord = Record<string, unknown>;

interface MatchHistoryResponse extends JsonRecord {
  match_history: JsonRecord[];
  player_name?: string;
  player_uid?: string | number;
  player_profile?: JsonRecord;
}

const RIVALS_TRACKER_API_BASE_URL = 'https://api.rivalstracker.com/api';
const RIVALS_TRACKER_FRESHNESS_SECONDS = 5 * 60;
const RIVALS_TRACKER_UPDATE_POLL_MS = 2_500;
const RIVALS_TRACKER_UPDATE_ATTEMPTS = 3;
const PROVIDER_UPDATE_TIMEOUT_MS = 8_000;

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await request.json() as { query?: string | number; limit?: number };
    const query = String(body.query ?? '').trim();
    const limit = Math.min(100, Math.max(1, Number(body.limit) || 50));
    if (!query) return json({ error: 'query is required' }, 400);

    const supabaseUrl = requiredEnvironmentValue('SUPABASE_URL');
    const serviceRoleKey = requiredEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY');
    const cooldownSeconds = positiveIntegerEnvironmentValue(
      'MATCH_HISTORY_SYNC_COOLDOWN_SECONDS',
      300,
    );
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const cooldownResult = await loadCooldownHistory(
      supabase,
      query,
      limit,
      cooldownSeconds,
    );
    if (cooldownResult) {
      return json({
        ...cooldownResult.history,
        source: 'supabase',
        sync_status: 'cooldown',
        next_sync_at: cooldownResult.nextSyncAt,
      });
    }

    const history = await fetchRivalsTrackerHistory(query, limit);
    const provider = 'rivalstracker';
    const playerUid = String(history.player_uid ?? query);
    const playerName = history.player_name
      ?? readString(history.player_profile, 'name')
      ?? query;
    const now = new Date().toISOString();

    const { data: player, error: playerError } = await supabase
      .from('players')
      .upsert({
        provider,
        provider_player_uid: playerUid,
        player_name: playerName,
        normalized_name: playerName.trim().toLowerCase(),
        profile: history.player_profile ?? null,
        updated_at: now,
      }, { onConflict: 'provider,provider_player_uid' })
      .select('id')
      .single();
    if (playerError) throw playerError;

    for (const match of history.match_history) {
      const matchUid = String(match['match_uid'] ?? '').trim();
      if (!matchUid) continue;

      const performance = asRecord(match['match_player'])
        ?? asRecord(match['player_performance'])
        ?? null;
      const rawPayload = { ...match };
      delete rawPayload['match_player'];
      delete rawPayload['player_performance'];
      const playedAt = toTimestamp(match['match_time_stamp']);

      const { data: storedMatch, error: matchError } = await supabase
        .from('matches')
        .upsert({
          provider,
          match_uid: matchUid,
          played_at: playedAt,
          raw_payload: rawPayload,
          updated_at: now,
        }, { onConflict: 'provider,match_uid' })
        .select('id')
        .single();
      if (matchError) throw matchError;

      const { error: linkError } = await supabase
        .from('player_matches')
        .upsert({
          player_id: player.id,
          match_id: storedMatch.id,
          played_at: playedAt,
          performance,
        }, { onConflict: 'player_id,match_id' });
      if (linkError) throw linkError;
    }

    const { error: syncStateError } = await supabase
      .from('match_history_sync_state')
      .upsert({
        player_id: player.id,
        last_synced_at: now,
        last_error: null,
        updated_at: now,
      }, { onConflict: 'player_id' });
    if (syncStateError) throw syncStateError;

    return json({ ...history, source: 'supabase' });
  } catch (error) {
    return json({ error: getErrorMessage(error) }, 500);
  }
});

async function loadCooldownHistory(
  supabase: ReturnType<typeof createClient>,
  query: string,
  limit: number,
  cooldownSeconds: number,
): Promise<{ history: MatchHistoryResponse; nextSyncAt: string } | null> {
  const player = await findStoredPlayer(supabase, query);
  if (!player) return null;

  const syncState = await supabase
    .from('match_history_sync_state')
    .select('last_synced_at')
    .eq('player_id', player.id)
    .maybeSingle();
  if (syncState.error) throw syncState.error;
  const lastSyncedAt = Date.parse(String(syncState.data?.last_synced_at ?? ''));
  if (!Number.isFinite(lastSyncedAt)) return null;

  const nextSyncAt = lastSyncedAt + cooldownSeconds * 1000;
  if (Date.now() >= nextSyncAt) return null;

  const result = await supabase
    .from('player_matches')
    .select(`
      played_at,
      performance,
      matches!inner (
        match_uid,
        raw_payload
      )
    `)
    .eq('player_id', player.id)
    .order('played_at', { ascending: false })
    .limit(limit);
  if (result.error) throw result.error;

  const matches = (result.data ?? []).map(row => {
    const relation = Array.isArray(row.matches) ? row.matches[0] : row.matches;
    const rawPayload = asRecord(relation?.raw_payload) ?? {};
    return {
      ...rawPayload,
      match_uid: relation?.match_uid ?? rawPayload['match_uid'],
      match_player: asRecord(row.performance) ?? undefined,
    };
  });

  return {
    history: {
      match_history: matches,
      player_name: player.player_name,
      player_uid: player.provider_player_uid,
      player_profile: asRecord(player.profile) ?? { name: player.player_name },
      pagination: {
        page: 1,
        limit,
        total_matches: matches.length,
        total_pages: 1,
        has_more: matches.length === limit,
      },
    },
    nextSyncAt: new Date(nextSyncAt).toISOString(),
  };
}

async function findStoredPlayer(
  supabase: ReturnType<typeof createClient>,
  query: string,
): Promise<{
  id: number;
  player_name: string;
  provider_player_uid: string;
  profile: unknown;
} | null> {
  const select = 'id, player_name, provider_player_uid, profile, updated_at';
  const byUid = await supabase
    .from('players')
    .select(select)
    .in('provider', ['marvelrivalsapi', 'rivalstracker'])
    .eq('provider_player_uid', query)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byUid.error) throw byUid.error;
  if (byUid.data) return byUid.data;

  const byName = await supabase
    .from('players')
    .select(select)
    .in('provider', ['marvelrivalsapi', 'rivalstracker'])
    .eq('normalized_name', query.toLowerCase())
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (byName.error) throw byName.error;
  return byName.data;
}

async function fetchRivalsTrackerHistory(
  query: string,
  limit: number,
): Promise<MatchHistoryResponse> {
  let uid = query;
  let fallbackName = query;

  if (!/^\d+$/.test(query)) {
    const searchResponse = await fetch(`${RIVALS_TRACKER_API_BASE_URL}/find-player`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: query }),
    });
    if (!searchResponse.ok) {
      throw new Error(`Rivalstracker search returned ${searchResponse.status}`);
    }

    const results = (await searchResponse.json() as unknown[]).filter(isRecord);
    const player = results.find(result =>
      readString(result, 'name')?.toLowerCase() === query.toLowerCase()
    ) ?? results[0];
    const playerUid = player?.['aid'];
    if (playerUid === undefined || playerUid === null) {
      throw new Error(`Rivalstracker found no player for ${query}`);
    }
    uid = String(playerUid);
    fallbackName = readString(player, 'name') ?? query;
  }

  let payload = await fetchRivalsTrackerPlayerPayload(uid);
  if (!isRivalsTrackerPayloadFresh(payload)) {
    payload = await refreshRivalsTrackerPlayerPayload(uid, payload);
  }

  const player = asRecord(payload['player']);
  const info = asRecord(player?.['info']);
  const playerName = readString(info, 'name') ?? fallbackName;
  const headIconId = info?.['cur_head_icon_id'];
  const allMatches = Array.isArray(payload['match_history'])
    ? payload['match_history'].filter(isRecord).map(normalizeRivalsTrackerMatch)
    : [];
  const matches = allMatches.slice(0, limit);

  return {
    match_history: matches,
    player_name: playerName,
    player_uid: uid,
    player_profile: {
      name: playerName,
      avatar: headIconId === undefined || headIconId === null
        ? undefined
        : `https://rivalstracker.com/images/Playerhead/img_playerhead_${encodeURIComponent(String(headIconId))}.png`,
    },
    pagination: {
      page: 1,
      limit,
      total_matches: allMatches.length,
      total_pages: Math.max(1, Math.ceil(allMatches.length / limit)),
      has_more: matches.length < allMatches.length,
    },
  };
}

async function fetchRivalsTrackerPlayerPayload(uid: string): Promise<JsonRecord> {
  const playerResponse = await fetch(
    `${RIVALS_TRACKER_API_BASE_URL}/player/${encodeURIComponent(uid)}`,
  );
  if (!playerResponse.ok) {
    throw new Error(`Rivalstracker player request returned ${playerResponse.status}`);
  }

  const payload = asRecord(await playerResponse.json());
  if (!payload) throw new Error('Rivalstracker returned an invalid player response');
  return payload;
}

function isRivalsTrackerPayloadFresh(payload: JsonRecord): boolean {
  const player = asRecord(payload['player']);
  const updatedAt = Math.max(
    numberOrZero(player?.['info_update_time']),
    numberOrZero(player?.['last_history_update']),
  );
  if (!updatedAt) return false;
  return Math.floor(Date.now() / 1000) - updatedAt <= RIVALS_TRACKER_FRESHNESS_SECONDS;
}

/**
 * Triggers a rivalstracker.com re-crawl for a stale player, then polls a
 * bounded number of times for a fresher payload. Degrades gracefully to the
 * initial (possibly stale) payload if the update call or the poll fails or
 * never observes fresher data within the attempt budget — freshness is a
 * best effort, not a hard requirement for the overall sync to succeed.
 */
async function refreshRivalsTrackerPlayerPayload(
  uid: string,
  initialPayload: JsonRecord,
): Promise<JsonRecord> {
  const updateRequested = await requestRivalsTrackerPlayerUpdate(uid);
  if (!updateRequested) return initialPayload;

  let latestPayload = initialPayload;
  for (let attempt = 0; attempt < RIVALS_TRACKER_UPDATE_ATTEMPTS; attempt++) {
    await delay(RIVALS_TRACKER_UPDATE_POLL_MS);

    try {
      latestPayload = await fetchRivalsTrackerPlayerPayload(uid);
    } catch (error) {
      console.warn('Rivalstracker refresh poll failed', getErrorMessage(error));
      continue;
    }

    if (isRivalsTrackerPayloadFresh(latestPayload)) return latestPayload;
  }

  return latestPayload;
}

async function requestRivalsTrackerPlayerUpdate(uid: string): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${RIVALS_TRACKER_API_BASE_URL}/update-player/${encodeURIComponent(uid)}`,
      { method: 'POST' },
      PROVIDER_UPDATE_TIMEOUT_MS,
    );
    if (!response.ok) {
      console.warn(`Rivalstracker update-player returned ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Rivalstracker update-player request failed', getErrorMessage(error));
    return false;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeRivalsTrackerMatch(match: JsonRecord): JsonRecord {
  const player = asRecord(match['match_player']);
  const normalized = {
    ...match,
    match_season: normalizeRivalsTrackerSeason(match['match_season']),
  };
  if (!player) return normalized;

  return {
    ...normalized,
    match_player: {
      ...player,
      kills: player['kills'] ?? player['k'] ?? 0,
      deaths: player['deaths'] ?? player['d'] ?? 0,
      assists: player['assists'] ?? player['a'] ?? 0,
      is_win: typeof player['is_win'] === 'number'
        ? player['is_win'] !== 0
        : player['is_win'],
      score_info: player['score_info'] ?? player['dynamic_fields'],
    },
  };
}

function normalizeRivalsTrackerSeason(value: unknown): unknown {
  const season = Number(value);
  return Number.isFinite(season) && season > 0 ? season / 2 : value;
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const record = asRecord(error);
  if (!record) return 'Unable to sync match history';

  const message = readString(record, 'message') ?? 'Unable to sync match history';
  const details = readString(record, 'details');
  const hint = readString(record, 'hint');
  return [message, details, hint].filter(Boolean).join(' ');
}

function readString(value: unknown, key: string): string | undefined {
  const candidate = asRecord(value)?.[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
}

function toTimestamp(value: unknown): string | null {
  const numericValue = typeof value === 'string' ? Number(value) : value;
  if (typeof numericValue !== 'number' || !Number.isFinite(numericValue)) return null;
  const milliseconds = numericValue < 1_000_000_000_000 ? numericValue * 1000 : numericValue;
  return new Date(milliseconds).toISOString();
}

function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
