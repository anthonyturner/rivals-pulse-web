/** `participants.play_mode_id`: -1 is stored when the game did not say which mode a match was. */
export const PLAY_MODE_IDS = { quickMatch: 0, competitive: 1, arcade: 2, practice: 3, unknown: -1 } as const;

/** The name of each mode id the site knows. A caller chooses what an id outside it is called. */
export const PLAY_MODE_NAMES: ReadonlyMap<number, string> = new Map([
  [PLAY_MODE_IDS.quickMatch, 'Quick Match'],
  [PLAY_MODE_IDS.competitive, 'Competitive'],
  [PLAY_MODE_IDS.arcade, 'Arcade'],
  [PLAY_MODE_IDS.practice, 'Practice'],
]);
