export function isRecord(value: unknown): value is Record<string, unknown> {
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
    /** A number, or null where the function leaves the column null (a figure it withholds). */
    nullableNumberOf(row: Record<string, unknown>, key: string): number | null {
      const value = row[key];

      if (value === null) {
        return null;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${functionName}: ${key} is not a number or null`);
      }

      return value;
    },
    booleanOf(row: Record<string, unknown>, key: string): boolean {
      const value = row[key];

      if (typeof value !== 'boolean') {
        throw new Error(`${functionName}: ${key} is not true or false`);
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

export type AnswerReader = ReturnType<typeof answerReader>;
