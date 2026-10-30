import { getSupabaseClient } from '../src/supabase-client.ts';

try {
  process.loadEnvFile?.('.env');
} catch {
  // Environment variables may already be provided by the shell or deployment host.
}

// The shared server client, with the local .env loaded first so scripts run the same way on a
// developer machine and in CI. Scripts import the client from here, never build their own.
export { getSupabaseClient };
