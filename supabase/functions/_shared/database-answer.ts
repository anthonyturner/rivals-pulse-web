/**
 * What a database function that names its outcome gives back: `{"status": ..., ...}`. Supabase hands
 * the JSON over untyped, so a handler reads it through this check instead of trusting its shape. An
 * answer that is not an object with a `status`, or that lacks a field its status promises, throws,
 * and the endpoint answers 500 rather than guessing what the database meant.
 */
export interface StatusAnswer {
  readonly status: string;
  /** A text field the status promises. */
  text(field: string): string;
  /** The wait, in whole seconds, that a `rate_limited` answer carries. */
  retryAfter(): number;
}

export function readStatusAnswer(value: unknown): StatusAnswer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The database answered with something that is not an object');
  }
  const fields = value as Record<string, unknown>;
  const { status } = fields;
  if (typeof status !== 'string') throw new Error('The database answer has no status');

  const missing = (field: string): Error => new Error(`The database answer "${status}" has no usable ${field}`);

  return {
    status,
    text(field) {
      const text = fields[field];
      if (typeof text !== 'string' || !text) throw missing(field);
      return text;
    },
    retryAfter() {
      const seconds = fields['retryAfter'];
      if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < 1) throw missing('retryAfter');
      return seconds;
    },
  };
}
