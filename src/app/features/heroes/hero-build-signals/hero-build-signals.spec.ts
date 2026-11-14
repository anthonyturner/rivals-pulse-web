import type { CommunityHeroScores, HeroScores, HeroScoreStat } from '../../../../contracts/hero-scores.model';
import {
  heroAbilityUseRows,
  heroBuildSignals,
  heroesWithScores,
  heroSignalCard,
  scoresSourceNote,
  teamBuildSignals,
} from './hero-build-signals';

const scored = (score: number, measures: Record<string, number>, label: HeroScoreStat['label'] = 'measured'): HeroScoreStat => ({
  status: 'scored',
  score,
  label,
  matches: 42,
  contributors: null,
  oneContributorAboveHalf: null,
  measures,
});

const collecting = (matches: number, contributors: number, oneContributorAboveHalf = false): HeroScoreStat => ({
  status: 'collecting',
  score: null,
  label: 'measured',
  matches,
  contributors,
  oneContributorAboveHalf,
  measures: null,
});

const noAbility: HeroScoreStat = {
  status: 'no-measurable-ability',
  score: null,
  label: 'estimated',
  matches: 0,
  contributors: null,
  oneContributorAboveHalf: null,
  measures: null,
};

const hela: HeroScores = {
  hero: 'hela',
  damage: scored(9, { damagePerMinute: 1180 }),
  sustain: scored(3, { healingPerMinute: 40, blockedPerMinute: 110, sustainPerMinute: 150 }),
  ultimate: scored(8, { usesPerTenMinutes: 1.6, takedownsPerUse: 2.1 }, 'estimated'),
  utility: scored(4, { useOfAvailable: 0.62, takedownsPerUse: 0.38 }, 'estimated'),
  abilities: [
    { slot: 'ability_2', ability: 'Soul Drainer', alsoIncludes: [], tag: 'Utility', usesPerTenMinutes: 31, takedownsPerUse: 0.38, matches: 42 },
    { slot: 'team_up_0', ability: null, alsoIncludes: [], tag: null, usesPerTenMinutes: 2.5, takedownsPerUse: null, matches: 12 },
  ],
};

const magneto: HeroScores = {
  hero: 'magneto',
  damage: collecting(5, 2),
  sustain: collecting(5, 2),
  ultimate: collecting(0, 0),
  utility: noAbility,
  abilities: [],
};

const answer = (heroes: HeroScores[]): CommunityHeroScores => ({
  status: 'ready',
  minimums: { matches: 10, contributors: 3, busiestContributorShare: 0.5, rankedHeroes: 5 },
  halfSeasons: [],
  halfSeason: { id: 21, label: 'Season 10.5' } as CommunityHeroScores['halfSeason'],
  inPlaceOf: null,
  heroes,
});

const row = (rows: ReturnType<typeof heroBuildSignals>, type: string) => rows.find((entry) => entry.type === type)!;

describe('heroBuildSignals', () => {
  it('shows each score, its source and the figures behind it', () => {
    const rows = heroBuildSignals('hela', answer([hela]));

    expect(rows.map((entry) => [entry.type, entry.source, entry.value])).toEqual([
      ['Damage', 'Measured', 9],
      ['Sustain', 'Measured', 3],
      ['Ultimate', 'Estimated', 8],
      ['Utility', 'Estimated', 4],
      ['Mobility', 'Hero kit', 5],
    ]);
    expect(row(rows, 'Damage').figures).toBe('1,180 damage per minute');
    expect(row(rows, 'Sustain').figures).toBe('40 healing and 110 blocked per minute');
    expect(row(rows, 'Ultimate').figures).toBe('1.6 ultimates per 10 minutes, 2.1 kills or assists after each');
    expect(row(rows, 'Utility').figures).toBe('Used 62% of what its cooldowns allowed, 0.38 kills or assists per use');
  });

  it('leaves a sustain figure the feed never sent out of the sentence', () => {
    const tank = { ...hela, sustain: scored(7, { blockedPerMinute: 412, sustainPerMinute: 412 }) };

    expect(row(heroBuildSignals('hela', answer([tank])), 'Sustain').figures).toBe('412 blocked per minute');
  });

  it('shows progress below the rule, in the steps the feed sends and never a score', () => {
    const damage = row(heroBuildSignals('magneto', answer([magneto])), 'Damage');

    expect(damage.value).toBeNull();
    expect(damage.valueLabel).toBe('Collecting data');
    expect(damage.detail).toBe('5 of 10 matches, 2 of 3 players');
  });

  it('reads a hero with no entry as 0 of each minimum', () => {
    const damage = row(heroBuildSignals('groot', answer([hela])), 'Damage');

    expect(damage.valueLabel).toBe('Collecting data');
    expect(damage.detail).toBe('0 of 10 matches, 0 of 3 players');
  });

  it('says when one player is what holds a hero back, and not while players are still short', () => {
    const held = { ...magneto, damage: collecting(10, 3, true), sustain: collecting(5, 1, true) };
    const rows = heroBuildSignals('magneto', answer([held]));

    expect(row(rows, 'Damage').detail).toContain('One player has more than half');
    expect(row(rows, 'Sustain').detail).toBe('5 of 10 matches, 1 of 3 players');
  });

  it('names the published share as the limit on the busiest player, not always half', () => {
    const held = { ...magneto, damage: collecting(10, 3, true) };
    const at = (busiestContributorShare: number) => ({
      ...answer([held]),
      minimums: { matches: 10, contributors: 3, busiestContributorShare, rankedHeroes: 5 },
    });

    expect(row(heroBuildSignals('magneto', at(0.5)), 'Damage').detail).toContain('One player has more than half of these matches');
    expect(row(heroBuildSignals('magneto', at(0.75)), 'Damage').detail).toContain('One player has more than 75% of these matches');
    expect(row(heroBuildSignals('magneto', at(0.75)), 'Damage').detail).not.toContain('half');
  });

  it('names no busiest player when the minimums put no limit on one', () => {
    const held = { ...magneto, damage: collecting(10, 3, true) };
    const unlimited = {
      ...answer([held]),
      minimums: { matches: 10, contributors: 3, busiestContributorShare: 1, rankedHeroes: 5 },
    };

    expect(row(heroBuildSignals('magneto', unlimited), 'Damage').detail).toBe('10 of 10 matches, 3 of 3 players');
  });

  it('stops the progress at each minimum when one busy player holds a hero back past them', () => {
    const held = { ...magneto, damage: collecting(30, 1, true), sustain: collecting(30, 5, true) };
    const rows = heroBuildSignals('magneto', answer([held]));

    expect(row(rows, 'Damage').detail).toBe('10 of 10 matches, 1 of 3 players');
    expect(row(rows, 'Sustain').detail).toBe(
      '10 of 10 matches, 3 of 3 players. One player has more than half of these matches, so it needs more players.',
    );
  });

  it('says plainly that no measurable ability is not a low score', () => {
    const utility = row(heroBuildSignals('magneto', answer([magneto])), 'Utility');

    expect(utility.value).toBeNull();
    expect(utility.valueLabel).toBe('Not measurable yet');
    expect(utility.detail).toContain('This is not a low score.');
  });

  it('shows the figures but no score while too few heroes qualify', () => {
    const waiting: HeroScores = {
      ...magneto,
      damage: { ...scored(1, { damagePerMinute: 812 }), status: 'ranking-too-small', score: null },
    };
    const damage = row(heroBuildSignals('magneto', answer([waiting])), 'Damage');

    expect(damage.value).toBeNull();
    expect(damage.valueLabel).toBe('Waiting for more heroes');
    expect(damage.figures).toBe('812 damage per minute');
    expect(damage.detail).toContain('5 heroes qualify');
  });

  it('keeps Mobility from the kit while the scores are loading or unreadable', () => {
    for (const scores of [undefined, null]) {
      const rows = heroBuildSignals('hela', scores);

      expect(row(rows, 'Mobility').value).toBe(5);
      expect(row(rows, 'Damage').value).toBeNull();
    }

    expect(row(heroBuildSignals('hela', undefined), 'Damage').valueLabel).toBe('Loading');
    expect(row(heroBuildSignals('hela', null), 'Damage').valueLabel).toBe('Not available');
  });

  it('never guesses Mobility for a hero without a value', () => {
    const mobility = row(heroBuildSignals('jubilee', answer([])), 'Mobility');

    expect(mobility.value).toBeNull();
    expect(mobility.valueLabel).toBe('No value yet');
  });
});

describe('heroSignalCard', () => {
  it('shows five tiles once the hero has any score, and a dash for the signals it lacks', () => {
    const partial = { ...hela, sustain: collecting(5, 2), utility: noAbility };
    const card = heroSignalCard('hela', answer([partial]));

    if (card.kind !== 'scored') {
      throw new Error(`Expected a scored card, got ${card.kind}`);
    }

    expect(card.tiles.map((tile) => [tile.shortLabel, tile.valueLabel])).toEqual([
      ['Dmg', '9'],
      ['Sus', '–'],
      ['Ult', '8'],
      ['Utl', '–'],
      ['Mob', '5'],
    ]);
    expect(card.sample).toBe('From 42 matches');
    expect(card.tiles[1].ariaLabel).toBe('Sustain: Collecting data');
  });

  it('shows the furthest progress for a hero with no score, ignoring no-measurable Utility', () => {
    expect(heroSignalCard('magneto', answer([magneto]))).toEqual({
      kind: 'waiting',
      heading: 'Collecting data',
      progress: '5 of 10 matches, 2 of 3 players',
      percent: 50,
    });
  });

  it('shows no progress for a hero with no entry', () => {
    expect(heroSignalCard('groot', answer([]))).toEqual({
      kind: 'waiting',
      heading: 'Collecting data',
      progress: '0 of 10 matches, 0 of 3 players',
      percent: 0,
    });
  });

  it('tells a hero that passed the rule from one still collecting', () => {
    const waiting: HeroScores = {
      ...magneto,
      damage: { ...scored(1, { damagePerMinute: 812 }), status: 'ranking-too-small', score: null },
    };
    const card = heroSignalCard('magneto', answer([waiting]));

    expect(card.kind === 'waiting' && card.heading).toBe('Waiting for more heroes');
  });

  it('has its own loading and failed states', () => {
    expect(heroSignalCard('hela', undefined).kind).toBe('loading');
    expect(heroSignalCard('hela', null).kind).toBe('unavailable');
  });
});

describe('teamBuildSignals', () => {
  const team = [
    { id: 'hela', name: 'Hela' },
    { id: 'magneto', name: 'Magneto' },
    { id: 'jubilee', name: 'Jubilee' },
  ];

  it('averages only the heroes with a number and says how many of the six it uses', () => {
    const luna: HeroScores = { ...hela, hero: 'luna-snow', damage: scored(3, { damagePerMinute: 300 }) };
    const rows = teamBuildSignals(
      [{ id: 'hela', name: 'Hela' }, { id: 'luna-snow', name: 'Luna Snow' }, { id: 'magneto', name: 'Magneto' }],
      answer([hela, luna, magneto]),
      6,
    );
    const damage = row(rows, 'Damage');

    expect(damage.value).toBe(6);
    expect(damage.valueLabel).toBe('6.0');
    expect(damage.used).toBe(2);
    expect(damage.detail).toBe('Uses 2 of 6 heroes: Hela, Luna Snow.');
    expect(damage.ariaLabel).toBe('Damage 6.0 out of 10, measured. Uses 2 of 6 heroes.');
  });

  it('notes heroes Utility cannot be measured for, without counting them', () => {
    const utility = row(teamBuildSignals(team, answer([hela, magneto]), 6), 'Utility');

    expect(utility.value).toBe(4);
    expect(utility.detail).toBe('Uses 1 of 6 heroes: Hela. Not measurable yet for 1 hero.');
  });

  it('leaves Mobility resting on the kit values it has, and needs no match data', () => {
    const mobility = row(teamBuildSignals(team, answer([]), 6), 'Mobility');

    expect(mobility.used).toBe(2);
    expect(mobility.detail).toBe("Uses 2 of 6 heroes. From each hero's kit, not match data.");
  });

  it('has no number at the launch state, and never reads a missing hero as 0', () => {
    const damage = row(teamBuildSignals(team, answer([]), 6), 'Damage');

    expect(damage.value).toBeNull();
    expect(damage.valueLabel).toBe('Collecting data');
    expect(damage.detail).toBe('Uses 0 of 6 heroes.');
  });

  it('says Utility is not measurable when that is true of every chosen hero', () => {
    const utility = row(teamBuildSignals([{ id: 'magneto', name: 'Magneto' }], answer([magneto]), 6), 'Utility');

    expect(utility.valueLabel).toBe('Not measurable yet');
  });

  it('says the scores failed rather than that they are collecting', () => {
    const damage = row(teamBuildSignals(team, null, 6), 'Damage');

    expect(damage.valueLabel).toBe('Not available');
    expect(damage.detail).toBe('Scores cannot be loaded right now.');
  });
});

describe('heroAbilityUseRows', () => {
  it('names the key and the ability, and says when several share a key or takedowns were not counted', () => {
    expect(heroAbilityUseRows('hela', answer([hela]))).toEqual([
      { slot: 'ability_2', keyLabel: 'E', ability: 'Soul Drainer', type: 'Utility', uses: '31.0', takedowns: '0.38', matches: '42' },
      {
        slot: 'team_up_0',
        keyLabel: 'C',
        ability: 'Several abilities on this key',
        type: 'Not tagged',
        uses: '2.5',
        takedowns: 'Not recorded',
        matches: '12',
      },
    ]);
  });

  it('calls the ultimate slot an ultimate, though the feed sends it no tag', () => {
    const ultimate = { ...hela, abilities: [{ slot: 'ultimate', ability: 'Goddess of Death', alsoIncludes: [], tag: null, usesPerTenMinutes: 1.6, takedownsPerUse: 2.1, matches: 42 }] };

    expect(heroAbilityUseRows('hela', answer([ultimate]))[0].type).toBe('Ultimate');
  });

  it('is empty for a hero with no entry, or no answer', () => {
    expect(heroAbilityUseRows('groot', answer([hela]))).toEqual([]);
    expect(heroAbilityUseRows('hela', null)).toEqual([]);
  });
});

describe('the summary lines', () => {
  it('counts heroes with at least one score', () => {
    expect(heroesWithScores(answer([hela, magneto]))).toBe(1);
    expect(heroesWithScores(null)).toBe(0);
  });

  it('states the rule from the answer, not a copy of it', () => {
    expect(scoresSourceNote(answer([]))).toContain('Season 10.5 Quick Match and Competitive');
    expect(scoresSourceNote(answer([]))).toContain('at least 10 matches from at least 3 players, with no single player making up more than half');
    expect(scoresSourceNote(null)).toBeNull();
  });
});

describe('solo build-signal testing', () => {
  const soloAnswer = (): CommunityHeroScores => ({
    ...answer([]),
    minimums: { matches: 10, contributors: 1, busiestContributorShare: 1, rankedHeroes: 5 },
  });

  it('explains that one player can supply every match during testing', () => {
    const note = scoresSourceNote(soloAnswer());
    expect(note).toContain('at least 10 matches');
    expect(note).toContain('one player can supply all matches');
    expect(note).not.toContain('more than half');
  });

  it('does not ask a solo contributor for more players on either display', () => {
    const data = { ...soloAnswer(), heroes: [{ ...magneto, hero: 'hela', damage: collecting(5, 1, true) }] };
    expect(heroBuildSignals('hela', data)[0].detail).toBe('5 of 10 matches');
    expect(heroSignalCard('hela', data)).toEqual({
      kind: 'waiting', heading: 'Collecting data', progress: '5 of 10 matches', percent: 50,
    });
    expect(heroBuildSignals('groot', soloAnswer())[0].detail).toBe('0 of 10 matches');
  });
});

describe('two players with no cap on one player\'s share', () => {
  const twoPlayers = (): CommunityHeroScores => ({
    ...answer([]),
    minimums: { matches: 10, contributors: 2, busiestContributorShare: 1, rankedHeroes: 5 },
  });

  it('states the player minimum and no cap on one player', () => {
    const note = scoresSourceNote(twoPlayers());
    expect(note).toContain('at least 10 matches from at least 2 players.');
    expect(note).not.toContain('more than half');
  });

  it('shows the player progress without blaming one busy player', () => {
    const data = { ...twoPlayers(), heroes: [{ ...magneto, hero: 'hela', damage: collecting(30, 2, true) }] };
    expect(heroBuildSignals('hela', data)[0].detail).toBe('10 of 10 matches, 2 of 2 players');
  });
});
