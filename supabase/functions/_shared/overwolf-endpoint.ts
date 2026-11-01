import { readStatusAnswer, type StatusAnswer } from './database-answer.ts';
import { IdentityError, recorderId, verifyOverwolfSession } from './overwolf-identity.ts';

/**
 * What every function the desktop app calls with an Overwolf session has in common: CORS, the method
 * check, confirming the session with Overwolf, turning the username into a `recorder_id`, and
 * answering an unexpected failure without leaking its cause. A function supplies only what it does
 * for that recorder. The pieces that touch the platform (environment, database client) come in as a
 * `runtime`, so the whole request path runs in the Node tests.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-overwolf-session',
  'Access-Control-Expose-Headers': 'Retry-After',
};

export function json(value: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

/** The answer for a recorder who has used up a database-side rate limit. */
export function rateLimited(message: string, retryAfter: number): Response {
  return json({ error: message, retryAfter }, 429, { 'Retry-After': String(retryAfter) });
}

/** What a call to a database function gives back, in the shape supabase-js uses. */
export interface RpcResult {
  data: unknown;
  error: { code?: string; message?: string } | null;
}

export type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<RpcResult>;

export interface EndpointRuntime {
  /** A trimmed environment value, or `undefined` when it is not set. */
  env(name: string): string | undefined;
  /** Calls a database function with the service role. */
  rpc: Rpc;
  /** Replaceable so a test need not reach Overwolf. */
  verifySession?: (token: string | null, extensionId: string) => Promise<{ username: string }>;
}

/** A call from a verified Overwolf session, ready to act for `recorder`. */
export interface OverwolfCall {
  request: Request;
  recorder: string;
  rpc: Rpc;
}

export interface EndpointSpec {
  /** Methods the function answers; `OPTIONS` is always answered for CORS. */
  methods: readonly string[];
  /** What the caller is told when something unexpected goes wrong. */
  failureMessage: string;
  handle(call: OverwolfCall): Promise<Response>;
}

/**
 * A request handler for `Deno.serve`. The session is confirmed before `handle` runs, so an unverified
 * caller is answered 401 (or 503 when Overwolf is down) and nothing else happens: no database call,
 * no read of the body.
 */
export function overwolfEndpoint(
  spec: EndpointSpec,
  runtime: EndpointRuntime,
): (request: Request) => Promise<Response> {
  const requiredEnv = (name: string): string => {
    const value = runtime.env(name);
    if (!value) throw new Error(`${name} is not configured`);
    return value;
  };

  return async request => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (!spec.methods.includes(request.method)) return json({ error: 'Method not allowed' }, 405);

    try {
      const verify = runtime.verifySession ?? verifyOverwolfSession;
      const { username } = await verify(
        request.headers.get('x-overwolf-session'),
        requiredEnv('OVERWOLF_EXTENSION_ID'),
      );
      const recorder = await recorderId(username, requiredEnv('RECORDER_ID_SECRET'));
      return await spec.handle({ request, recorder, rpc: runtime.rpc });
    } catch (error) {
      if (error instanceof IdentityError) return json({ error: error.message }, error.status);
      console.error(`${spec.failureMessage}: ${errorMessage(error)}`);
      return json({ error: spec.failureMessage }, 500);
    }
  };
}

/**
 * The answer of a database function that names its outcome. A failed call, or an answer that is not
 * one this reader recognises, throws, so the endpoint answers 500.
 */
export function unwrapStatus(result: RpcResult): StatusAnswer {
  if (result.error) throw result.error;
  return readStatusAnswer(result.data);
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' ? message : 'unknown error';
}
