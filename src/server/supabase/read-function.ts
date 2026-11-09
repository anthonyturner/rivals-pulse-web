import type { SupabaseClient } from '@supabase/supabase-js';

import { isNotAppliedCode } from './not-applied.ts';

const READ_TIMEOUT_MS = 5000;

/**
 * Calls one read function with the server's service-role client and returns its answer. Resolves
 * to null while the migration is not applied, which is the designed "nothing counted yet" state;
 * any other failure (a refused key, a server error, a timeout) throws, so an outage is never hidden
 * behind that state. The error names the function and the code, never the data.
 */
export async function callReadFunction(client: Pick<SupabaseClient, 'rpc'>, functionName: string): Promise<unknown> {
  const { data, error } = await client
    .rpc(functionName)
    .retry(false)
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  if (error) {
    if (isNotAppliedCode(error.code)) {
      console.warn(`${functionName} is not in the database yet; its readers show the empty state`);

      return null;
    }

    throw new Error(`${functionName} failed${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  }

  return data;
}
