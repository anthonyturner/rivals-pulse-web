import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { EndpointRuntime } from './overwolf-endpoint.ts';

/**
 * The real platform behind `overwolfEndpoint`: Deno's environment and a service-role client for the
 * project. Only a deployed function runs this file, which is why the logic lives elsewhere and the
 * Node tests never import it. The client is made on first use, so a missing key is a 500 on that
 * call rather than a crash at start-up.
 */
export function denoRuntime(): EndpointRuntime {
  const env = (name: string) => Deno.env.get(name)?.trim() || undefined;
  let client: ReturnType<typeof createClient> | undefined;

  return {
    env,
    rpc: (name, args) => {
      const url = env('SUPABASE_URL');
      const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !serviceKey) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured');
      client ??= createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      return client.rpc(name, args);
    },
  };
}
