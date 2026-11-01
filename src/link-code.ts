/**
 * Reads a link code the way a person types it. Codes are Crockford base32: eight characters from
 * digits and letters without I, L, O and U, shown as `XXXX-XXXX`. A typed `o` is a zero and a typed
 * `i` or `l` is a one, so the usual slips still work.
 *
 * The desktop app makes the codes (`supabase/functions/issue-link-code/link-code.ts`); a test there
 * keeps the two alphabets in step. This file imports nothing so both sides can load it.
 */
const SEPARATORS = /[\s\-_‐-―]/g;
const CANONICAL = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/** The eight canonical characters of a typed code, or null when it cannot be one. */
export function normalizeLinkCode(typed: unknown): string | null {
  if (typeof typed !== 'string') {
    return null;
  }

  const canonical = typed
    .replace(SEPARATORS, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');

  return CANONICAL.test(canonical) ? canonical : null;
}
