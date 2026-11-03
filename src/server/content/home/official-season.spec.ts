import { parseCurrentSeason } from './official-season';

describe('parseCurrentSeason', () => {
  it('reads the season and story from a dev vision headline', () => {
    expect(
      parseCurrentSeason([
        "Season 10: Butcher's Blasphemy // Dev Vision Vol. 21 | Marvel Rivals",
      ]),
    ).toEqual({ currentSeason: 'Season 10', seasonStory: "Butcher's Blasphemy" });
  });

  it('reads the new season when a patch headline names it first', () => {
    // Regression: the patch headline sorted first and matched "Season 10"
    // without the "//" the story pattern required, which silently pinned the
    // home page to the previous season.
    expect(
      parseCurrentSeason([
        'Marvel Rivals Version 20260911 Patch Notes - Season 10 Arrives',
        "Season 10: Butcher's Blasphemy // Dev Vision Vol. 21 | Marvel Rivals",
        'Marvel Rivals Version 20260911 Balance Post',
      ]),
    ).toEqual({ currentSeason: 'Season 10', seasonStory: "Butcher's Blasphemy" });
  });

  it('ignores headlines left over from the previous season', () => {
    expect(
      parseCurrentSeason([
        'Season 9 Incentive Event - Winners Announcement',
        "Season 10: Butcher's Blasphemy // Dev Vision Vol. 21",
      ]),
    ).toEqual({ currentSeason: 'Season 10', seasonStory: "Butcher's Blasphemy" });
  });

  it('keeps the season story when a mid-season patch names only the number', () => {
    expect(
      parseCurrentSeason([
        'Marvel Rivals Version 20261001 Patch Notes - Season 10.5 Update',
        "Season 10: Butcher's Blasphemy // Dev Vision Vol. 21",
      ]),
    ).toEqual({ currentSeason: 'Season 10', seasonStory: "Butcher's Blasphemy" });
  });

  it('returns the season without a story when no headline names one', () => {
    expect(parseCurrentSeason(['Version 20261010 Patch Notes - Season 11 Arrives'])).toEqual({
      currentSeason: 'Season 11',
      seasonStory: undefined,
    });
  });

  it('returns undefined when no headline mentions a season', () => {
    expect(parseCurrentSeason(['Marvel Rivals Version 20260903 Patch Notes'])).toBeUndefined();
  });
});
