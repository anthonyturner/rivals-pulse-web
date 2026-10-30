export const SUPABASE_READ_ENV_NAMES = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;

export type SupabaseReadEnv = Readonly<Record<string, string | undefined>>;

const READ_TIMEOUT_MS = 5000;

/**
 * Calls one Postgres function over PostgREST (Supabase's REST layer) with the publishable key and
 * returns its JSON answer. The aggregate functions are the only thing that key can reach: the
 * aggregate tables themselves have no grant, so a leaked key reads nothing it should not.
 *
 * `what` names the feature in the not-configured message ("Hero stats"). An error never carries the
 * key or the response body.
 */
export async function callSupabaseFunction(
  what: string,
  functionName: string,
  args: Record<string, unknown>,
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  const url = env['SUPABASE_URL']?.trim();
  const key = env['SUPABASE_PUBLISHABLE_KEY']?.trim();

  if (!url || !key) {
    const missing = SUPABASE_READ_ENV_NAMES.filter((name) => !env[name]?.trim());
    throw new Error(`${what} are not configured. Set ${missing.join(' and ')}.`);
  }

  const response = await fetcher(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${functionName} answered ${response.status}`);
  }

  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Typed readers for a function's answer. Each one rejects anything off-shape with an error that
 * names the function, so a changed answer fails the request instead of printing NaN.
 */
export function answerReader(functionName: string) {
  const recordOf = (value: unknown, what: string): Record<string, unknown> => {
    if (!isRecord(value)) {
      throw new Error(`${functionName}: ${what} is not an object`);
    }

    return value;
  };

  return {
    recordOf,
    recordsOf(value: unknown, what: string): Record<string, unknown>[] {
      if (!Array.isArray(value)) {
        throw new Error(`${functionName}: ${what} is not a list`);
      }

      return value.map((row) => recordOf(row, `an entry of ${what}`));
    },
    numberOf(row: Record<string, unknown>, key: string): number {
      const value = row[key];

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${functionName}: ${key} is not a number`);
      }

      return value;
    },
    stringOf(row: Record<string, unknown>, key: string): string {
      const value = row[key];

      if (typeof value !== 'string') {
        throw new Error(`${functionName}: ${key} is not a string`);
      }

      return value;
    },
  };
}
