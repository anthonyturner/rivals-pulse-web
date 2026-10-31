/**
 * Reads the jsonb a `read_*` aggregate function returns. Whatever comes back is untrusted: a field
 * that is missing or the wrong type is an error that names the function and the field, never a
 * NaN that reaches a page.
 */
export interface AggregatePayloadReader {
  object(value: unknown, what: string): Record<string, unknown>;
  list(value: unknown, what: string): Record<string, unknown>[];
  number(row: Record<string, unknown>, key: string): number;
  string(row: Record<string, unknown>, key: string): string;
}

export function aggregatePayloadReader(functionName: string): AggregatePayloadReader {
  const object = (value: unknown, what: string): Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`${functionName}: ${what} is not an object`);
    }

    return value as Record<string, unknown>;
  };

  return {
    object,
    list(value, what) {
      if (!Array.isArray(value)) {
        throw new Error(`${functionName}: ${what} is not a list`);
      }

      return value.map((row) => object(row, `a ${what} entry`));
    },
    number(row, key) {
      const value = row[key];

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${functionName}: ${key} is not a number`);
      }

      return value;
    },
    string(row, key) {
      const value = row[key];

      if (typeof value !== 'string') {
        throw new Error(`${functionName}: ${key} is not a string`);
      }

      return value;
    },
  };
}
