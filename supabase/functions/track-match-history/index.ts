import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { IdentityError, recorderId, verifyOverwolfSession } from '../_shared/overwolf-identity.ts';
import {
  asRecord,
  parseParticipants,
  PayloadError,
  readHalfSeason,
  readMatchUid,
  readPlayedAt,
  rosterFingerprint,
  storableMatch,
} from './match-payload.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-overwolf-session',
};

const MAX_TRACKED_MATCHES_PER_PLAYER = 500;
const PROVIDER = 'gep';

/**
 * Uploads one user may make per hour. Matches last ten minutes or more, so a player sends a handful
 * an hour; 30 leaves room for a long session and for retries without letting a script flood the table.
 */
const UPLOAD_LIMIT = 30;
const UPLOAD_WINDOW = '1 hour';

/**
 * Records a match from the app. The caller must hold an Overwolf session token that Overwolf confirms;
 * `playerName` in the body is still the client's claim (issue 388 binds it).
 */
Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const { username } = await verifyOverwolfSession(
      request.headers.get('x-overwolf-session'),
      requiredEnvironmentValue('OVERWOLF_EXTENSION_ID'),
    );
    const recordedBy = await recorderId(username, requiredEnvironmentValue('RECORDER_ID_SECRET'));

    const supabase = createClient(
      requiredEnvironmentValue('SUPABASE_URL'),
      requiredEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: retryAfter, error: slotError } = await supabase.rpc('claim_upload_slot', {
      p_recorded_by: recordedBy,
      p_limit: UPLOAD_LIMIT,
      p_window: UPLOAD_WINDOW,
    });
    if (slotError) throw slotError;
    if (retryAfter > 0) {
      return json(
        { error: 'Too many matches uploaded; try again later' },
        429,
        { 'Retry-After': String(retryAfter) },
      );
    }

    const body = await request.json().catch(() => null) as { playerName?: string; match?: unknown } | null;
    if (!body) return json({ error: 'A JSON body is required' }, 400);
    const playerName = String(body.playerName ?? '').trim();
    const match = asRecord(body.match);
    if (!playerName) return json({ error: 'playerName is required' }, 400);
    if (!match) return json({ error: 'match is required' }, 400);

    const matchUid = readMatchUid(match);
    const playedAt = readPlayedAt(match, Date.now());
    const halfSeason = readHalfSeason(match);
    const participants = parseParticipants(match);
    const fingerprint = await rosterFingerprint(participants);
    const { rawPayload, performance } = storableMatch(match);

    const now = new Date().toISOString();
    const playerUid = playerName.toLowerCase();

    const { data: player, error: playerError } = await supabase
      .from('players')
      .upsert({
        provider: PROVIDER,
        provider_player_uid: playerUid,
        player_name: playerName,
        normalized_name: playerUid,
        updated_at: now,
      }, { onConflict: 'provider,provider_player_uid' })
      .select('id')
      .single();
    if (playerError) throw playerError;

    const { error: trackedMatchError } = await supabase
      .from('tracked_matches')
      .upsert({
        player_id: player.id,
        provider: PROVIDER,
        match_uid: matchUid,
        played_at: playedAt,
        raw_payload: rawPayload,
        performance,
        recorded_at: now,
      }, { onConflict: 'player_id,match_uid' });
    if (trackedMatchError) throw trackedMatchError;

    await pruneTrackedMatches(supabase, player.id);

    const { data: stored, error: participantsError } = await supabase.rpc('record_match_participants', {
      p_fingerprint: fingerprint,
      p_half_season: halfSeason,
      p_played_at: playedAt,
      p_recorded_by: recordedBy,
      p_players: participants,
    });
    if (participantsError) throw participantsError;

    await purgeExpiredParticipants(supabase);

    return json({ status: 'ok', recorded: 1, participants: stored });
  } catch (error) {
    if (error instanceof IdentityError) return json({ error: error.message }, error.status);
    if (error instanceof PayloadError) return json({ error: error.message }, 400);
    return json({ error: getErrorMessage(error) }, 500);
  }
});

async function pruneTrackedMatches(
  supabase: ReturnType<typeof createClient>,
  playerId: number,
): Promise<void> {
  const { data: keepRows, error: keepError } = await supabase
    .from('tracked_matches')
    .select('id')
    .eq('player_id', playerId)
    .order('played_at', { ascending: false })
    .limit(MAX_TRACKED_MATCHES_PER_PLAYER);
  if (keepError) throw keepError;

  const keepIds = (keepRows ?? []).map(row => row.id);
  if (keepIds.length < MAX_TRACKED_MATCHES_PER_PLAYER) return;

  const { error: pruneError } = await supabase
    .from('tracked_matches')
    .delete()
    .eq('player_id', playerId)
    .not('id', 'in', `(${keepIds.join(',')})`);
  if (pruneError) throw pruneError;
}

/**
 * Retention does not depend on the daily schedule being enabled: every upload also sweeps. A failed
 * sweep is logged and does not fail the upload, which has already been stored.
 */
async function purgeExpiredParticipants(supabase: ReturnType<typeof createClient>): Promise<void> {
  const { error } = await supabase.rpc('purge_expired_participants');
  if (error) console.error(`Participant retention sweep failed: ${getErrorMessage(error)}`);
}

function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const record = asRecord(error);
  if (!record) return 'Unable to track match history';

  const message = readString(record, 'message') ?? 'Unable to track match history';
  const details = readString(record, 'details');
  const hint = readString(record, 'hint');
  return [message, details, hint].filter(Boolean).join(' ');
}

function readString(value: unknown, key: string): string | undefined {
  const candidate = asRecord(value)?.[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : undefined;
}

function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}
