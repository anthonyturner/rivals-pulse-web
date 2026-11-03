import type { SupabaseClient } from '@supabase/supabase-js';

// Only specs import this file.

export interface RecordedCall {
  table: string;
  /** Every builder method called on the query, in order, with its arguments. */
  steps: [method: string, args: unknown[]][];
}

export interface FakeResponse {
  data?: unknown;
  count?: number;
  error?: { message: string } | null;
}

/**
 * A stand-in for the Supabase client in specs. Whatever builder chain the code runs, `respond`
 * answers it with the rows or error to return once the chain is awaited. `from(table)` and
 * `rpc(name, args)` both record a call.
 */
export function fakeSupabaseClient(respond: (call: RecordedCall) => FakeResponse): {
  client: SupabaseClient;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];

  function startChain(table: string, steps: RecordedCall['steps']): unknown {
    const call: RecordedCall = { table, steps };
    const chain: unknown = new Proxy(
      {},
      {
        get: (_target, method: string) => {
          if (method === 'then') {
            return (resolve: (value: unknown) => void) => {
              calls.push(call);
              const { data = null, count = null, error = null } = respond(call);
              resolve({ data, count, error });
            };
          }

          return (...args: unknown[]) => {
            steps.push([method, args]);

            return chain;
          };
        },
      },
    );

    return chain;
  }

  const client = {
    from: (table: string) => startChain(table, []),
    rpc: (name: string, args: unknown) => startChain('rpc', [['rpc', [name, args]]]),
  } as unknown as SupabaseClient;

  return { client, calls };
}
