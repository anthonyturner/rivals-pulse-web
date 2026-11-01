import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { IdentityError, recorderId, verifyOverwolfSession } from '../_shared/overwolf-identity.ts';
import { formatLinkCode, generateLinkCode } from './link-code.ts';
import { readPlayerClaim } from './player-claim.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-overwolf-session',
  'Access-Control-Expose-Headers': 'Retry-After',
};

/** A code works for ten minutes and once; the issuing function enforces both. */
const CODE_TTL = '10 minutes';
/**
 * A player asks for a code a few times at most; five covers retries without letting a script farm
 * them. The window they are counted over is `link_issue_window()` in the database, which the purge
 * shares.
 */
const ISSUE_LIMIT = 5;
/** Two recorders drawing the same code is a 1 in 2^40 event; a retry makes it invisible. */
const CODE_ATTEMPTS = 3;
const UNIQUE_VIOLATION = '23505';

/**
 * Gives the app a one-time code to type on the website (issue 264). The caller must hold an Overwolf
 * session that Overwolf confirms: the link rests on that identity, not on the name or uid in the
 * body, which are the app's claims and are only shown back to the player.
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
    const recorder = await recorderId(username, requiredEnvironmentValue('RECORDER_ID_SECRET'));

    const player = readPlayerClaim(await request.json().catch(() => null));
    if (!player) {
      return json(
        { error: 'Play one match with the app open first, then ask for a code again.', reason: 'no-player' },
        422,
      );
    }

    const supabase = createClient(
      requiredEnvironmentValue('SUPABASE_URL'),
      requiredEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = generateLinkCode();
      const { data, error } = await supabase.rpc('issue_link_code', {
        p_recorder_id: recorder,
        p_code: code,
        p_player_uid: player.uid,
        p_player_name: player.name,
        p_avatar_url: player.avatarUrl,
        p_ttl: CODE_TTL,
        p_limit: ISSUE_LIMIT,
      });

      if (error?.code === UNIQUE_VIOLATION) continue;
      if (error) throw error;

      if (data?.status === 'rate_limited') {
        return json(
          { error: 'Too many codes requested; try again later', retryAfter: data.retryAfter },
          429,
          { 'Retry-After': String(data.retryAfter) },
        );
      }

      return json({ code: formatLinkCode(code), expiresAt: data.expiresAt });
    }

    throw new Error('A link code could not be issued');
  } catch (error) {
    if (error instanceof IdentityError) return json({ error: error.message }, error.status);
    console.error(`Link code not issued: ${errorMessage(error)}`);
    return json({ error: 'Unable to issue a link code' }, 500);
  }
});

function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : 'unknown error';
}

function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}
