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

// Until the first Turso migration slice adds a web table, `players` is the one
// table guaranteed to exist on every project this repo owns. The probe only
// counts it (head-only), so no row ever leaves the database.
const PROBE_TABLE = 'players';

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

export async function getSupabaseStatus(
  env: SupabaseEnv = process.env,
  options: SupabaseClientOptions = {},
): Promise<SupabaseStatus> {
  if (!isSupabaseConfigured(env)) {
    return { configured: false, reachable: false };
  }

  // No retries: postgrest-js otherwise backs off for about 7 seconds on a
  // network failure, and the status endpoint should answer at once.
  const { error } = await createSupabaseClient(env, options)
    .from(PROBE_TABLE)
    .select('*', { count: 'exact', head: true })
    .retry(false);

  return { configured: true, reachable: !error };
}
