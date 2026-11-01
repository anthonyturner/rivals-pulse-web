export interface AnswerSource {
  label: string;
  url: string;
}

/**
 * The sources behind the ban answer, checked 2026-10-30, Overwolf's first and NetEase's terms last.
 * A sentence in `buildBanAnswer` changes only when one of these does.
 */
export const BAN_ANSWER_SOURCES: readonly AnswerSource[] = [
  { label: 'Overwolf: our commitment', url: 'https://www.overwolf.com/our-commitment' },
  {
    label: 'Overwolf: Marvel Rivals game events',
    url: 'https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/marvel-rivals',
  },
  {
    label: 'Overwolf: game compliance guide',
    url: 'https://dev.overwolf.com/ow-native/guides/game-compliance/overview',
  },
  { label: 'NetEase terms of use, updated 15 December 2024', url: 'https://store.steampowered.com/eula/2767030_eula_0' },
];

/**
 * The answer to "will Rivals Pulse get me banned?", written once for the overlay FAQ and the home
 * page. Overwolf's review is only a fact about Rivals Pulse once the listing exists, so the last
 * clause follows `listed`.
 */
export function buildBanAnswer(listed: boolean): string {
  const tail = listed
    ? ', and Rivals Pulse is an official Overwolf app'
    : ", though Rivals Pulse isn't listed on the Overwolf store yet";

  return (
    "No. Rivals Pulse is built on Overwolf and reads match information only through Overwolf's official Marvel Rivals game events, the same approved data other Overwolf apps for the game use. " +
    "It doesn't modify the game, inject into it, or automate anything, and it's built to follow the Marvel Rivals Terms of Service. " +
    `Overwolf states that apps on its platform comply with each game's terms and that using them won't get you banned${tail}.`
  );
}
