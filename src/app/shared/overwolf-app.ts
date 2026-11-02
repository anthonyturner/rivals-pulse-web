/**
 * Where people install the app. Empty until the app clears Overwolf's QA
 * review and gets a listing; every get-app button renders an unavailable "coming soon"
 * state while it is, never a placeholder URL.
 */
export const OVERWOLF_APP_URL = '';

export interface OverwolfListingStats {
  downloads: number | null;
  /** Out of 5. */
  rating: number | null;
}

/** The listing's figures for the home page hero. Null until the listing has them, which reads "Coming soon". */
export const OVERWOLF_LISTING_STATS: OverwolfListingStats = { downloads: null, rating: null };
