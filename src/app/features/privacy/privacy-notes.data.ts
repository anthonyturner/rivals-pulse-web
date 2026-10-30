export interface UploadField {
  label: string;
  detail: string;
}

/**
 * Flip to 'uploaded' in the pull request that ships the extended upload (issue 176 server side,
 * overlay issue 1157 app side). The page then stops calling those fields "being added".
 */
export type ExtendedUploadStatus = 'being-added' | 'uploaded';
export const EXTENDED_UPLOAD_STATUS: ExtendedUploadStatus = 'being-added';

/** What the desktop app uploads for every human player on the scoreboard of a match it records. */
export const TODAY_UPLOAD_FIELDS: readonly UploadField[] = [
  { label: 'In-game name', detail: 'As the game shows it on the scoreboard.' },
  { label: 'Player id', detail: 'The number the game uses to identify a player.' },
  { label: 'Team', detail: 'Which side of the match the player was on.' },
  { label: 'Hero', detail: 'The hero the player had picked.' },
  { label: 'Kills, deaths and assists', detail: 'The scoreboard figures.' },
  {
    label: 'Final hits',
    detail: 'Killing blows, counted from the kill feed. Left blank when the game hides a name.',
  },
  { label: 'Result', detail: 'Win or loss, worked out from the result the uploading player saw.' },
  {
    label: 'Game mode',
    detail: 'For example Quick Match or Competitive. Shared by every line in the match.',
  },
  { label: 'Map', detail: 'The map name. Shared by every line in the match.' },
  { label: 'When it was played', detail: 'The match time and the half-season it belongs to.' },
];

/** Figures the desktop app is adding to its upload, in the payload shape of issue 176. */
export const EXTENDED_UPLOAD_FIELDS: readonly UploadField[] = [
  { label: 'Damage', detail: 'Damage dealt by the uploading player.' },
  { label: 'Healing', detail: 'Healing done by the uploading player.' },
  { label: 'Damage blocked', detail: 'Damage blocked by the uploading player.' },
  { label: 'Time played per hero', detail: 'How long the uploading player spent on each hero.' },
  {
    label: 'Kill feed',
    detail: 'Which hero defeated which hero, and how many times, with no player names or ids.',
  },
];
