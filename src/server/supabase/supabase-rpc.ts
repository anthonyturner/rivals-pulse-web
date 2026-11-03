const SUPABASE_READ_ENV_NAMES = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;

/** One page of a function that returns a set of rows; see `callSupabaseFunction`. */
interface SupabasePage {
  offset: number;
  limit: number;
  /** Columns to sort by before the range is cut, so pages never overlap or skip on the function's own order. */
  order?: readonly string[];
  /** PostgREST column filters, such as `{ rank_bucket: 'eq.-1' }`, applied before the range is cut. */
  filters?: Readonly<Record<string, string>>;
}

export type SupabaseReadEnv = Readonly<Record<string, string | undefined>>;

const READ_TIMEOUT_MS = 5000;

/**
 * PostgREST answers 404 with `PGRST202` for a function that is not in the database, and a missing
 * table or function inside a query comes back as Postgres `42P01` or `42883`.
 */
const NOT_DEPLOYED_CODES: readonly string[] = ['PGRST202', '42P01', '42883'];

/** A refused call. It keeps the status and the error code, never the response body or the key. */
class SupabaseFunctionError extends Error {
  constructor(
    readonly functionName: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(`${functionName} answered ${status}`);
    this.name = 'SupabaseFunctionError';
  }
}

/** True when the function, or a table it reads, is not in the database yet: the migration is not applied. */
function isNotDeployedError(error: unknown): boolean {
  return (
    error instanceof SupabaseFunctionError &&
    (error.status === 404 || (error.code !== undefined && NOT_DEPLOYED_CODES.includes(error.code)))
  );
}

/**
 * The answer of a read, or `whenMissing` while the function it calls is not in the database yet (the
 * migration is not applied), which is the designed empty state. Any other failure, such as a refused
 * key, a timeout or a missing configuration, is thrown, so an outage is never hidden behind it.
 */
export async function orWhenNotDeployed<T>(read: Promise<T>, functionName: string, whenMissing: T): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (!isNotDeployedError(error)) {
      throw error;
    }

    console.warn(`${functionName} is not in the database yet; its readers show the empty state`);

    return whenMissing;
  }
}

/**
 * Calls one Postgres function over PostgREST (Supabase's REST layer) with the publishable key and
 * returns its JSON answer. The aggregate functions are the only thing that key can reach: the
 * aggregate tables themselves have no grant, so a leaked key reads nothing it should not.
 *
 * `what` names the feature in the not-configured message ("Hero stats"). An error never carries the
 * key or the response body. A function that returns a set of rows is cut by PostgREST at its
 * `max-rows` (1000 on Supabase), so such a caller asks for one `page` at a time.
 */
export async function callSupabaseFunction(
  what: string,
  functionName: string,
  args: Record<string, unknown>,
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
  page?: SupabasePage,
): Promise<unknown> {
  const url = env['SUPABASE_URL']?.trim();
  const key = env['SUPABASE_PUBLISHABLE_KEY']?.trim();

  if (!url || !key) {
    const missing = SUPABASE_READ_ENV_NAMES.filter((name) => !env[name]?.trim());
    throw new Error(`${what} are not configured. Set ${missing.join(' and ')}.`);
  }

  const query = page === undefined ? '' : pageQuery(page);
  const response = await fetcher(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${functionName}${query}`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new SupabaseFunctionError(functionName, response.status, await errorCodeOf(response));
  }

  return response.json();
}

function pageQuery(page: SupabasePage): string {
  const order = page.order?.length ? `&order=${page.order.join(',')}` : '';

  const filters = Object.entries(page.filters ?? {}).map(([column, filter]) => `&${column}=${filter}`);

  return `?limit=${page.limit}&offset=${page.offset}${order}${filters.join('')}`;
}

async function errorCodeOf(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    const code = isRecord(body) ? body['code'] : undefined;

    return typeof code === 'string' ? code : undefined;
  } catch {
    // An error body that is not JSON has no code; the status alone is reported.
    return undefined;
  }
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
    /** The top-level answer, which must be an object. */
    answerOf(value: unknown): Record<string, unknown> {
      if (!isRecord(value)) {
        throw new Error(`${functionName} did not return an object`);
      }

      return value;
    },
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
