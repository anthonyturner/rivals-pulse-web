/**
 * What a player may ask to have removed. The server reads this file too (`src/account-api.ts`), so it
 * imports nothing: the browser and the API must agree on these words.
 */
export type DeletionMode =
  /** The sign-in details and our row for them. */
  | 'account'
  /** The same, plus the player's uploaded match data. Not built yet: the server refuses it. */
  | 'account-and-matches';

export interface DeleteAccountRequest {
  mode: DeletionMode;
  /** What the player typed; it has to match {@link DELETE_CONFIRMATION_PHRASE}. */
  confirmation: string;
}

export const DELETION_MODES: readonly DeletionMode[] = ['account', 'account-and-matches'];

export const DELETE_CONFIRMATION_PHRASE = 'delete my account';

/** Case and surrounding spaces do not matter: the typing is a speed bump, not a password. */
export function isDeletionConfirmed(typed: string): boolean {
  return typed.trim().toLowerCase() === DELETE_CONFIRMATION_PHRASE;
}
