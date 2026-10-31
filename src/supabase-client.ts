/// <reference types="node" />
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_ENV_NAMES = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

export type SupabaseEnv = Readonly<Record<string, string | undefined>>;

export interface SupabaseClientOptions {
  fetch?: typeof fetch;
}

export interface SupabaseStatus {
  configured: boolean;
  reachable: boolean;
}

// `players` is an overlay-facing table whose name is frozen (shipped overlays
// write to it), so the probe never breaks when a web table changes. It only
// counts it (head-only), so no row ever leaves the database.
const PROBE_TABLE = 'players';
const PROBE_TIMEOUT_MS = 3000;

let sharedClient: SupabaseClient | undefined;

export function findMissingSupabaseEnv(env: SupabaseEnv): string[] {
  return SUPABASE_ENV_NAMES.filter((name) => !env[name]?.trim());
}

export function isSupabaseConfigured(env: SupabaseEnv): boolean {
  return findMissingSupabaseEnv(env).length === 0;
}

export function createSupabaseClient(
  env: SupabaseEnv,
  options: SupabaseClientOptions = {},
): SupabaseClient {
  const url = env['SUPABASE_URL']?.trim();
  const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY']?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(`Supabase is not configured. Set ${findMissingSupabaseEnv(env).join(' and ')}.`);
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(options.fetch ? { global: { fetch: options.fetch } } : {}),
  });
}

/** The shared client for server code, created from `process.env` on first use. */
export function getSupabaseClient(): SupabaseClient {
  sharedClient ??= createSupabaseClient(process.env);

  return sharedClient;
}

/**
 * Never throws: a misconfigured or unreachable project is reported, not raised.
 * Without `env` it probes through the shared client.
 */
export async function getSupabaseStatus(
  env?: SupabaseEnv,
  options: SupabaseClientOptions = {},
): Promise<SupabaseStatus> {
  if (!isSupabaseConfigured(env ?? process.env)) {
    return { configured: false, reachable: false };
  }

  try {
    const client = env ? createSupabaseClient(env, options) : getSupabaseClient();
    // No retries and a short timeout: postgrest-js otherwise backs off for
    // about 7 seconds on a network failure, and a status check should answer
    // at once.
    const { error } = await client
      .from(PROBE_TABLE)
      .select('*', { count: 'exact', head: true })
      .retry(false)
      .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));

    return { configured: true, reachable: !error };
  } catch (error) {
    // createClient throws on a malformed SUPABASE_URL; the message never holds a key.
    console.warn('Supabase status probe failed', error instanceof Error ? error.message : error);

    return { configured: true, reachable: false };
  }
}
