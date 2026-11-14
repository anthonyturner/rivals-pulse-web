/**
 * The defaults a signed-in account chooses for gameplay video and sound. The server reads this file too
 * (`src/server/account/account-api.ts`), so it imports nothing: the browser and the API must agree on these words.
 */
export interface MediaDefaults {
  /** Whether a hero page opens on the gameplay video instead of the portrait. */
  heroVideo: boolean;
  /** Whether the gameplay video and the home pulse banner make sound by default. */
  sound: boolean;
}

/** A save names the defaults it changes and leaves the others as they are. */
export type MediaDefaultsChange = Partial<MediaDefaults>;

/** `{ heroVideo, sound }` as two real booleans, or null for anything else: a missing value is never read as "off". */
export function parseMediaDefaults(value: unknown): MediaDefaults | null {
  const { heroVideo, sound } = (value ?? {}) as { heroVideo?: unknown; sound?: unknown };

  return typeof heroVideo === 'boolean' && typeof sound === 'boolean' ? { heroVideo, sound } : null;
}

/** The change a request body asks for, or null when it names no default or names one that is not a boolean. */
export function parseMediaDefaultsChange(value: unknown): MediaDefaultsChange | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { heroVideo, sound } = value as { heroVideo?: unknown; sound?: unknown };

  if ((heroVideo !== undefined && typeof heroVideo !== 'boolean') || (sound !== undefined && typeof sound !== 'boolean')) {
    return null;
  }

  return heroVideo === undefined && sound === undefined
    ? null
    : { ...(heroVideo === undefined ? {} : { heroVideo }), ...(sound === undefined ? {} : { sound }) };
}
