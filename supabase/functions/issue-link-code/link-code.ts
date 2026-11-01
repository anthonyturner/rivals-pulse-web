/**
 * Crockford's base32: digits and letters without I, L, O and U, so a code read off a screen and typed
 * by hand cannot be confused. The website reads a typed code with the same rules (`src/link-code.ts`);
 * `link-code.test.ts` keeps the two in step.
 */
export const LINK_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const LINK_CODE_LENGTH = 8;

/**
 * Eight random characters, about 40 bits. The alphabet has 32 letters and a byte holds 256 values, so
 * keeping the low five bits of each byte leaves every letter equally likely.
 */
export function generateLinkCode(
  fillRandom: (bytes: Uint8Array) => Uint8Array = bytes => crypto.getRandomValues(bytes),
): string {
  const bytes = fillRandom(new Uint8Array(LINK_CODE_LENGTH));
  return Array.from(bytes, byte => LINK_CODE_ALPHABET[byte & 31]).join('');
}

/** The form shown to the player: `XXXX-XXXX`. */
export function formatLinkCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
