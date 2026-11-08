export interface UploadField {
  label: string;
  detail: string;
}

export type ExtendedUploadStatus = 'being-added' | 'uploaded';
export const EXTENDED_UPLOAD_STATUS: ExtendedUploadStatus = 'uploaded';

export type PulseRecordsStatus = 'being-added' | 'open';
/** Flip to 'open' in the change that opens the Pulse Records pages, so the privacy page stops saying nothing is published yet. */
export const PULSE_RECORDS_STATUS: PulseRecordsStatus = 'being-added';

/** What the desktop app uploads for a match it records: each human player's line plus the match facts. */
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
  { label: 'Match length', detail: 'How long the match lasted.' },
  { label: 'Match id', detail: 'The identifier the game gives the match.' },
];

/** Figures the desktop app also uploads, in the payload shape of issue 176. */
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

/** Planned after the extended upload, with overlay issue 1284 and issue 457, so it has no share in its status. */
export const PLANNED_UPLOAD_FIELDS: readonly UploadField[] = [
  {
    label: 'Ability and ultimate use',
    detail:
      'How often the uploading player used each ability and their ultimate on each hero. This shows that an ability was used, not whether it hit anyone. Never uploaded for other players.',
  },
];
