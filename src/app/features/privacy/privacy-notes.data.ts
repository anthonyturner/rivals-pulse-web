export interface UploadField {
  label: string;
  detail: string;
}

export type ExtendedUploadStatus = 'being-added' | 'uploaded';
export const EXTENDED_UPLOAD_STATUS: ExtendedUploadStatus = 'uploaded';

export type PulseRecordsStatus = 'being-added' | 'open';
/** Set to 'being-added' while the Pulse Records pages are closed, so the privacy page says nothing is published yet. */
export const PULSE_RECORDS_STATUS: PulseRecordsStatus = 'open';

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

/** Figures the desktop app also uploads, in the payload shape of issue 176, with the later additions of issues 457 and 654. */
export const EXTENDED_UPLOAD_FIELDS: readonly UploadField[] = [
  { label: 'Damage', detail: 'Damage dealt by the uploading player.' },
  { label: 'Healing', detail: 'Healing done by the uploading player.' },
  { label: 'Damage blocked', detail: 'Damage blocked by the uploading player.' },
  { label: 'Time played per hero', detail: 'How long the uploading player spent on each hero.' },
  {
    label: 'Kill feed',
    detail: 'Which hero defeated which hero, and how many times, with no player names or ids.',
  },
  {
    label: 'Ability and ultimate use',
    detail:
      'How often the uploading player used each ability and their ultimate on each hero. This shows that an ability was used, not whether it hit anyone. Never uploaded for other players.',
  },
  {
    label: 'Hero changes during the match',
    detail:
      'For every player, the heroes they played and how many seconds into the match each pick happened, grouped by team. It carries no player names or ids and is stored once per match, with the one-way code of the player who uploaded it (described under what the app uploads today). It is stored under the same match key as the scoreboard lines of that match, so it can in practice be linked back to a scoreboard line, and anyone who reads both can tell which player made which hero changes and when. It is used to count how often switching to a hero while an enemy hero is in play goes on to win.',
  },
];
