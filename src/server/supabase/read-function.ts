import type { SupabaseClient } from '@supabase/supabase-js';

const READ_TIMEOUT_MS = 5000;

// What Postgres and PostgREST answer when the migration has not been applied yet: PGRST202 is "no
// such function in the schema cache", 42883 an undefined function and 42P01 an undefined table.
const NOT_APPLIED_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883', '42P01']);

/**
 * Calls one read function with the server's service-role client and returns its answer. Resolves
 * to null while the migration is not applied, which is the designed "nothing counted yet" state;
 * any other failure (a refused key, a server error, a timeout) throws, so an outage is never hidden
 * behind that state. The error names the function and the code, never the data.
 */
export async function callReadFunction(client: SupabaseClient, functionName: string): Promise<unknown> {
  const { data, error } = await client
    .rpc(functionName)
    .retry(false)
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  if (error) {
    if (error.code !== undefined && NOT_APPLIED_CODES.has(error.code)) {
      console.warn(`${functionName} is not in the database yet; its readers show the empty state`);

      return null;
    }

    throw new Error(`${functionName} failed${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  }

  return data;
}
