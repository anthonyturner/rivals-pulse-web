import { BAN_ANSWER_SOURCES, buildBanAnswer } from './ban-answer';

describe('the ban answer', () => {
  it('says the same four sentences the FAQ page always has, for an unlisted app', () => {
    expect(buildBanAnswer(false)).toBe(
      "No. RivalsPulse is built on Overwolf and reads match information only through Overwolf's official Marvel Rivals game events, the same approved data other Overwolf apps for the game use. It doesn't modify the game, inject into it, or automate anything, and it's built to follow the Marvel Rivals Terms of Service. Overwolf states that apps on its platform comply with each game's terms and that using them won't get you banned, though RivalsPulse isn't listed on the Overwolf store yet.",
    );
  });

  it('calls RivalsPulse an official Overwolf app only once it is listed', () => {
    expect(buildBanAnswer(true)).toMatch(/won't get you banned, and RivalsPulse is an official Overwolf app\.$/);
    expect(buildBanAnswer(false)).not.toContain('official Overwolf app');
  });

  it('leads with the Overwolf sources and keeps the NetEase terms last', () => {
    expect(BAN_ANSWER_SOURCES.map((source) => source.url)).toEqual([
      'https://www.overwolf.com/our-commitment',
      'https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/marvel-rivals',
      'https://dev.overwolf.com/ow-native/guides/game-compliance/overview',
      'https://store.steampowered.com/eula/2767030_eula_0',
    ]);
  });
});
