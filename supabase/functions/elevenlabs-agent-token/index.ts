/**
 * Mints a short-lived ElevenLabs conversation token for the Jarvis voice assistant (issue 499).
 *
 * This function exists for one reason: the app ships to players as a packed `.opk`, so anything
 * embedded in it is readable by anyone who installs it. An ElevenLabs API key in the client would
 * be a key handed to every user. The key lives here instead, as an edge-function secret, and the
 * client only ever receives a token that is useless once the conversation ends.
 *
 * The key is read from `ELEVENLABS_MAIN_API_KEY`. An earlier `ELEVENLABS_API_KEY` secret also
 * exists on the project and is **not** the one to use -- it lacks the `convai_write` scope that
 * minting requires, and pointing at it produces a 401 that reads like a code fault rather than a
 * configuration one. Delete that secret rather than leaving two names for one credential.
 *
 * Minting a token does not start a session and is not billed. The per-minute charge starts when
 * the client connects with it, which is why the client holds the session open on an idle timer
 * rather than reconnecting per question -- see `JarvisSessionService`.
 *
 * ## Who may call this (issue 569)
 *
 * Anyone who has the app can. The function's URL and the project's publishable key both ship in
 * the `.opk`, and there is no player sign-in to check instead. So keeping the API key on the
 * server protects the key but not the bill: a caller outside the app can mint a token, connect,
 * and hold a session open, and the client-side session ceiling (`JARVIS_MAX_SESSION_MS`) does not
 * apply to code that is not this app.
 *
 * `verify_jwt` is deliberately `false` in `supabase/config.toml` and must stay that way. The
 * project uses the newer publishable key (`sb_publishable_…`), which is not a JWT, and the
 * platform's JWT check only understands the legacy JWT keys -- turning it on rejects the app's own
 * requests and silences Jarvis for every player. Supabase's guidance for these keys is to leave
 * the platform check off and authorize in the function, which is what the rate limit below does.
 *
 * The limit bounds the cost of a caller; it does not identify one. The other bound is the agent's
 * own maximum conversation duration, set in the ElevenLabs dashboard, which no caller can bypass.
 *
 * Premium gate (issue 870): when `TEBEX_STORE_PUBLIC_TOKEN` is set, only a verified Overwolf user
 * with a paid plan gets a token (see `checkPremiumGate` and docs/supabase-prod-checklist.md).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkPremiumGate } from '../_shared/premium-gate.ts';

/**
 * Tokens one IP address may mint per `TOKEN_WINDOW_MS`.
 *
 * Each token is one Jarvis session -- a hotkey press, or the match-end wrap-up. A player uses a
 * handful an hour; 30 leaves room for a few players sharing one household address without letting
 * a script open sessions without end.
 */
const TOKEN_LIMIT = 30;
const TOKEN_WINDOW_MS = 60 * 60 * 1000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-overwolf-session',
};

const TOKEN_ENDPOINT = 'https://api.elevenlabs.io/v1/convai/conversation/token';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const limit = await checkRateLimit(clientIp(request));
    if (!limit.allowed) {
      return json(
        { error: 'Too many conversation tokens requested; try again later' },
        429,
        { 'Retry-After': String(limit.retryAfterSeconds) },
      );
    }

    const premium = await checkPremiumGate({
      getEnv: name => Deno.env.get(name),
      getSessionToken: () => request.headers.get('x-overwolf-session'),
    });
    if (!premium.allowed) return json(premium.body, premium.status);

    const apiKey = requiredEnvironmentValue('ELEVENLABS_MAIN_API_KEY');
    const agentId = requiredEnvironmentValue('ELEVENLABS_AGENT_ID');

    const response = await fetch(`${TOKEN_ENDPOINT}?agent_id=${encodeURIComponent(agentId)}`, {
      headers: { 'xi-api-key': apiKey },
    });

    if (!response.ok) {
      // ElevenLabs' own message is safe to surface -- it carries the status and reason, never the
      // key. Truncated so a large error body cannot become the response.
      const detail = await response.text().catch(() => '');
      console.error(`ElevenLabs token request failed: ${response.status} ${detail.slice(0, 300)}`);
      // The upstream status and ElevenLabs' own reason travel back to the caller. Neither can
      // contain the API key, and without them a misconfigured key and a wrong agent id are the
      // same opaque 502 -- which costs a dashboard log-dive to tell apart every time.
      return json({
        error: 'Could not mint a conversation token',
        upstreamStatus: response.status,
        upstreamDetail: upstreamReason(detail),
      }, 502);
    }

    const body = await response.json() as { token?: unknown };
    if (typeof body.token !== 'string' || !body.token) {
      return json({ error: 'ElevenLabs returned no token' }, 502);
    }

    return json({ token: body.token });
  } catch (error) {
    // Never log the error object itself: it can carry the request headers, and those carry the key.
    console.error(`Jarvis token minting failed: ${getErrorMessage(error)}`);
    return json({ error: 'Could not mint a conversation token' }, 500);
  }
});

/**
 * ElevenLabs' own explanation, pulled out of its error envelope when it has one.
 *
 * Their errors arrive as `{ detail: { message, status } }` or occasionally as a bare string. Only
 * the message is forwarded, and only the first 200 characters of it: enough to tell "missing the
 * permission convai_write" from "agent not found", which are the two failures worth separating.
 */
function upstreamReason(detail: string): string {
  try {
    const parsed = JSON.parse(detail) as { detail?: unknown };
    const inner = parsed.detail;
    if (typeof inner === 'string') return inner.slice(0, 200);
    if (inner && typeof inner === 'object') {
      const message = (inner as { message?: unknown }).message;
      if (typeof message === 'string') return message.slice(0, 200);
    }
  } catch {
    // Not JSON -- fall through to the raw text.
  }
  return detail.slice(0, 200);
}

type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Records this token request and says whether the caller is still under `TOKEN_LIMIT`.
 *
 * **Fails open.** If the table cannot be read or written, the token is minted anyway and the
 * failure is logged. The alternative silences Jarvis for every player whenever the database
 * hiccups -- or whenever this function is deployed before its migration, which is the order a
 * rushed rollout goes in. The cost of failing open is an unbounded window only while the
 * database is failing, and the agent's server-side duration cap still holds throughout.
 *
 * Count-then-insert is not atomic, so a burst of concurrent requests can pass a few over the
 * limit. That bounds a caller loosely rather than exactly, which is all this needs to do.
 */
async function checkRateLimit(ip: string): Promise<RateLimitDecision> {
  try {
    const supabase = createClient(
      requiredEnvironmentValue('SUPABASE_URL'),
      requiredEnvironmentValue('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const windowStart = new Date(Date.now() - TOKEN_WINDOW_MS).toISOString();

    const { data: recent, error: readError } = await supabase
      .from('jarvis_token_requests')
      .select('requested_at')
      .eq('client_ip', ip)
      .gte('requested_at', windowStart)
      .order('requested_at', { ascending: true })
      .limit(TOKEN_LIMIT);
    if (readError) throw readError;

    if ((recent?.length ?? 0) >= TOKEN_LIMIT) {
      // The window reopens when the oldest request in it ages out.
      const oldest = Date.parse(String(recent![0].requested_at));
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + TOKEN_WINDOW_MS - Date.now()) / 1000));
      return { allowed: false, retryAfterSeconds };
    }

    const { error: insertError } = await supabase
      .from('jarvis_token_requests')
      .insert({ client_ip: ip });
    if (insertError) throw insertError;

    // Rows older than the window can never count again. Pruned across every address rather than
    // just this one, so an address that never returns does not leave its rows behind for good.
    const { error: pruneError } = await supabase
      .from('jarvis_token_requests')
      .delete()
      .lt('requested_at', windowStart);
    if (pruneError) console.error(`Jarvis token rate-limit prune failed: ${getErrorMessage(pruneError)}`);

    return { allowed: true };
  } catch (error) {
    console.error(`Jarvis token rate limit unavailable, minting anyway: ${getErrorMessage(error)}`);
    return { allowed: true };
  }
}

/**
 * The caller's address as the Supabase edge gateway reports it.
 *
 * `x-forwarded-for` can hold a chain; the first entry is the client. Callers the gateway gives no
 * address for share one `unknown` bucket -- limited together rather than not limited at all.
 */
function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function requiredEnvironmentValue(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  // supabase-js reports database failures as plain `{ message, code, details }` objects, not
  // Errors -- without this the rate limiter's failures would all log as "Unknown error".
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : 'Unknown error';
}

function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}
