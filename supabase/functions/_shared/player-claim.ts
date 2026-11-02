/**
 * The only hosts an avatar may come from. Overwolf serves the account avatar that
 * `overwolf.profile.getCurrentUser` returns; the exact host has not been captured from a real
 * session yet, so any host under overwolf.com is accepted (the overlay's manifest already trusts
 * `https://*.overwolf.com`). Replace this with the real host once one is seen.
 */
export const OVERWOLF_AVATAR_DOMAINS: readonly string[] = ['overwolf.com'];

const MAX_AVATAR_URL_LENGTH = 500;
const MAX_UID_LENGTH = 64;
const MAX_NAME_LENGTH = 64;

/** What the app says a player looks like: the part of a claim that can change after linking. */
export interface PlayerProfile {
  name: string;
  avatarUrl: string | null;
}

/** What the app says about its player. Shown on the website, never used to decide who owns what. */
export interface PlayerClaim extends PlayerProfile {
  uid: string;
}

/**
 * The avatar URL when it is a plain `https` address on an allowed host, else `null`. Anything else
 * is dropped, not repaired: the page shows a fallback instead.
 */
export function allowedAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_AVATAR_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const onAllowedHost = OVERWOLF_AVATAR_DOMAINS.some(
    domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`),
  );
  const plain = url.protocol === 'https:' && !url.username && !url.password && !url.port;

  return plain && onAllowedHost ? url.href : null;
}

/**
 * The name and avatar the app sent, or `null` when there is no name. Control characters are
 * stripped and the name capped; an avatar that is not allowed becomes `null`.
 */
export function readPlayerProfile(body: unknown): PlayerProfile | null {
  if (typeof body !== 'object' || body === null) return null;
  const { playerName, avatarUrl } = body as Record<string, unknown>;

  const name = cleanText(playerName, MAX_NAME_LENGTH);
  return name ? { name, avatarUrl: allowedAvatarUrl(avatarUrl) } : null;
}

/**
 * The player the app named, or `null` when it has no uid or name yet (no match was played with the
 * app open). Control characters are stripped and lengths capped.
 */
export function readPlayerClaim(body: unknown): PlayerClaim | null {
  const profile = readPlayerProfile(body);
  const uid = cleanText((body as Record<string, unknown> | null)?.playerUid, MAX_UID_LENGTH);
  return profile && uid ? { uid, ...profile } : null;
}

/**
 * Control characters, plus the invisible ones that reorder or hide text (zero-width and bidi marks,
 * embeddings and isolates): a name shown in the header must not be able to flip the text around it.
 */
const UNSAFE_TEXT = /[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g;

/**
 * A string, or a whole number (the game's uid is numeric), cleaned and cut to `maxLength` code
 * points, so no surrogate pair is split.
 */
function cleanText(value: unknown, maxLength: number): string {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  if (typeof text !== 'string') return '';
  return Array.from(text.replace(UNSAFE_TEXT, '').trim()).slice(0, maxLength).join('').trim();
}
