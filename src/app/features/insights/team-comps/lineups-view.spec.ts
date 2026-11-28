import { season } from '../hero-matchup.fixtures';
import { lineupShape, lineupsOf, thinShape } from '../team-lineups.fixtures';
import { buildLineupsView, lineupsMethodNote, type LineupRowView, type LineupsView } from './lineups-view';

function ready(view: LineupsView): LineupRowView[] {
  if (view.state !== 'ready') {
    throw new Error(`expected a ready view, got ${view.state}`);
  }

  return view.rows;
}

describe('buildLineupsView', () => {
  it('is unavailable, not empty, when the line-ups could not be loaded', () => {
    expect(buildLineupsView(null, 10.5)).toEqual({ state: 'unavailable' });
  });

  it('is "not enough data" when no line-up has reached the minimum, naming it', () => {
    expect(buildLineupsView(lineupsOf([thinShape(2, 2, 2)]), 10.5)).toEqual({
      state: 'not-enough-data',
      notice: null,
      minimumLabel: '50 teams',
    });
    expect(buildLineupsView(lineupsOf([]), 10.5).state).toBe('not-enough-data');
  });

  it('lists the line-ups with figures most played first, as percentages of teams', () => {
    const rows = ready(
      buildLineupsView(lineupsOf([lineupShape(1, 2, 3, 250, 100), lineupShape(2, 2, 2, 600, 330)]), 10.5),
    );

    expect(rows.map(({ shape, figures }) => [shape, figures?.pickRateLabel, figures?.winRateLabel, figures?.teams])).toEqual([
      ['2-2-2', '60.0%', '55.0%', 600],
      ['1-2-3', '25.0%', '40.0%', 250],
    ]);
  });

  it('breaks a tie on teams by the shape, so the order never depends on the answer', () => {
    const rows = ready(buildLineupsView(lineupsOf([lineupShape(2, 2, 2, 300, 150), lineupShape(1, 2, 3, 300, 150)]), 10.5));

    expect(rows.map(({ shape }) => shape)).toEqual(['1-2-3', '2-2-2']);
  });

  it('lists a line-up under the minimum after the ones with figures, with no figures', () => {
    const rows = ready(
      buildLineupsView(lineupsOf([thinShape(3, 2, 1), lineupShape(2, 2, 2, 600, 330), thinShape(1, 1, 4)]), 10.5),
    );

    expect(rows.map(({ shape, figures }) => [shape, figures])).toEqual([
      ['2-2-2', jasmine.any(Object)],
      ['3-2-1', null],
      ['1-1-4', null],
    ]);
  });

  it('writes each line-up for players, singular where it is one', () => {
    const rows = ready(buildLineupsView(lineupsOf([lineupShape(2, 2, 2, 600, 330), thinShape(1, 0, 5)]), 10.5));

    expect(rows[0].caption).toBe('2 tanks · 2 DPS · 2 supports');
    expect(rows[0].spoken).toBe('2 tanks, 2 DPS and 2 supports');
    expect(rows[1].caption).toBe('1 tank · 0 DPS · 5 supports');
    expect(rows[1].spoken).toBe('1 tank, 0 DPS and 5 supports');
  });

  it('marks three Strategists as triple support and four or more as quad support, and no fewer', () => {
    const rows = ready(
      buildLineupsView(
        lineupsOf([
          lineupShape(2, 2, 2, 600, 330),
          lineupShape(1, 2, 3, 250, 100),
          lineupShape(1, 1, 4, 90, 40),
          thinShape(0, 1, 5),
          thinShape(2, 3, 1),
        ]),
        10.5,
      ),
    );

    expect(rows.map(({ shape, supportLabel }) => [shape, supportLabel])).toEqual([
      ['2-2-2', null],
      ['1-2-3', 'Triple support'],
      ['1-1-4', 'Quad support'],
      ['0-1-5', 'Quad support'],
      ['2-3-1', null],
    ]);
  });

  it('skips a line-up marked ready whose figures cannot be read, rather than showing NaN', () => {
    const broken = { ...lineupShape(3, 3, 0, 80, 40), winRate: Number.NaN };
    const rows = ready(buildLineupsView(lineupsOf([lineupShape(2, 2, 2, 600, 330), broken]), 10.5));

    expect(rows.map(({ shape }) => shape)).toEqual(['2-2-2']);
  });

  it('is "not enough data" when the only line-up marked ready cannot be read', () => {
    const broken = { ...lineupShape(3, 3, 0, 80, 40), teams: null };

    expect(buildLineupsView(lineupsOf([broken]), 10.5).state).toBe('not-enough-data');
  });

  it('names its own half-season when it differs from the page, and why', () => {
    const view = buildLineupsView(lineupsOf([lineupShape(2, 2, 2, 600, 330)], { halfSeason: season(10), inPlaceOf: season(10.5) }), 10.5);

    expect(view.state === 'ready' && view.notice).toBe(
      'Season 10.5 does not have enough Competitive data yet, so these are Season 10\'s Competitive numbers until it does.',
    );
  });

  it('says nothing when it shows the same half-season as the page', () => {
    expect(buildLineupsView(lineupsOf([lineupShape(2, 2, 2, 600, 330)]), 10.5)).toEqual(
      jasmine.objectContaining({ notice: null }),
    );
  });
});

describe('lineupsMethodNote', () => {
  it('says what the pick rate is out of and how many teams are left out', () => {
    expect(lineupsMethodNote(lineupsOf([], { classifiedTeams: 163, unclassifiedTeams: 12 }))).toBe(
      'Line-up pick rates are out of the 163 teams whose heroes all have a known role. 12 teams had a hero no role is known for (one the game did not record, for instance) and are in no line-up.',
    );
  });

  it('agrees with a single team left out', () => {
    expect(lineupsMethodNote(lineupsOf([], { classifiedTeams: 1, unclassifiedTeams: 1 }))).toBe(
      'Line-up pick rates are out of the 1 team whose heroes all have a known role. 1 team had a hero no role is known for (one the game did not record, for instance) and is in no line-up.',
    );
  });

  it('leaves out the sentence about unclassified teams when there are none', () => {
    expect(lineupsMethodNote(lineupsOf([], { classifiedTeams: 163, unclassifiedTeams: 0 }))).toBe(
      'Line-up pick rates are out of the 163 teams whose heroes all have a known role.',
    );
  });

  it('counts the unclassified teams even when no team was classified', () => {
    expect(lineupsMethodNote(lineupsOf([], { classifiedTeams: 0, unclassifiedTeams: 4 }))).toContain('4 teams had a hero no role is known for');
  });

  it('is null when the line-ups could not be loaded or nothing was counted', () => {
    expect(lineupsMethodNote(null)).toBeNull();
    expect(lineupsMethodNote(lineupsOf([], { classifiedTeams: 0, unclassifiedTeams: 0 }))).toBeNull();
  });
});
