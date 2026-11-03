/**
 * The in-game player an account is linked to, as the session answer carries it. The server reads this
 * file too (`src/server/auth/auth-gateway.ts`), so it imports nothing: the browser and the API must agree on it.
 */
export interface LinkedPlayer {
  /** The name the desktop app reported when the code was made. */
  name: string;
  /** An `https` Overwolf avatar address, or null when the app had none we accept. */
  avatarUrl: string | null;
}
