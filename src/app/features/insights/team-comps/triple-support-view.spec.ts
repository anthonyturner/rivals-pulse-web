import type { HeroIdentities } from '../hero-identity';
import { season } from '../hero-matchup.fixtures';
import { trio, triosOf } from '../triple-support-trios.fixtures';
import { TRIOS_PER_VARIANT, buildTripleSupportView, type TripleSupportView } from './triple-support-view';

const identities: HeroIdentities = new Map([
  ['mantis', { name: 'Mantis', role: 'Strategist', imageUrl: '/images/heroes/mantis.png' }],
  ['luna-snow', { name: 'Luna Snow', role: 'Strategist', imageUrl: null }],
  ['loki', { name: 'Loki', role: 'Strategist', imageUrl: null }],
]);

const MANTIS_TRIPLE = 'Mantis triple';
const THREE_HEALERS = 'Three healers';

function ready(view: TripleSupportView) {
  if (view.state !== 'ready') {
    throw new Error(`expected a ready view, got ${view.state}`);
  }

  return view;
}

describe('buildTripleSupportView', () => {
  it('is unavailable, not empty, when the trios could not be loaded', () => {
    expect(buildTripleSupportView(null, 10.5, identities)).toEqual({ state: 'unavailable' });
  });

  it('is "not enough data" below the minimum, naming it', () => {
    const view = buildTripleSupportView(triosOf([]), 10.5, identities);

    expect(view).toEqual({ state: 'not-enough-data', notice: null, minimumLabel: '10 matches' });
  });

  it('groups trios by variant and puts the variant with the most teams first', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([
          trio(['loki', 'luna-snow', 'mantis'], THREE_HEALERS, 12, 6),
          trio(['luna-snow', 'mantis', 'loki'], MANTIS_TRIPLE, 30, 18),
          trio(['mantis', 'loki', 'luna-snow'], THREE_HEALERS, 20, 10),
        ]),
        10.5,
        identities,
      ),
    );

    expect(view.variants.map(({ label, rows }) => [label, rows.length])).toEqual([
      [THREE_HEALERS, 2],
      [MANTIS_TRIPLE, 1],
    ]);
  });

  it('puts the larger of two variants first by the sum of its shares, not by its biggest trio', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([
          trio(['loki', 'luna-snow', 'mantis'], 'Solo triple', 25, 12),
          trio(['loki', 'luna-snow', 'mantis'], 'Spread triple', 20, 8),
          trio(['luna-snow', 'mantis', 'loki'], 'Spread triple', 15, 8),
        ]),
        10.5,
        identities,
      ),
    );

    expect(view.variants.map(({ label }) => label)).toEqual(['Spread triple', 'Solo triple']);
  });

  it('orders the trios of a variant by pick share, then matches', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([
          trio(['loki', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 12, 6),
          trio(['luna-snow', 'mantis', 'loki'], MANTIS_TRIPLE, 30, 18),
        ]),
        10.5,
        identities,
      ),
    );

    expect(view.variants[0].rows.map((row) => row.matches)).toEqual([30, 12]);
  });

  it('shows each trio with three hero portraits, its pick share and its win rate over team occurrences', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([trio(['luna-snow', 'mantis', 'loki'], MANTIS_TRIPLE, 20, 0, { teams: 24, wins: 15, share: 0.12 })]),
        10.5,
        identities,
      ),
    );
    const [row] = view.variants[0].rows;

    expect(row.heroes.map(({ name }) => name)).toEqual(['Luna Snow', 'Mantis', 'Loki']);
    expect(row.heroes[1].imageUrl).toBe('/images/heroes/mantis.png');
    expect([row.shareLabel, row.winRateLabel, row.matches]).toEqual(['12.0%', '62.5%', 20]);
  });

  it('sums a variant into one line so variants compare at a glance', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([
          trio(['loki', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 20, 10),
          trio(['luna-snow', 'mantis', 'loki'], MANTIS_TRIPLE, 20, 14),
        ]),
        10.5,
        identities,
      ),
    );

    expect(view.variants[0].summary).toBe('2 trios together: 20.0% of teams · 60.0% win rate');
  });

  it(`lists at most ${TRIOS_PER_VARIANT} trios of a variant and says how many are not shown`, () => {
    const many = Array.from({ length: TRIOS_PER_VARIANT + 2 }, (_, index) =>
      trio(['loki', 'luna-snow', `hero-${index}`], MANTIS_TRIPLE, 20 + index, 10),
    );
    const view = ready(buildTripleSupportView(triosOf(many), 10.5, identities));

    expect(view.variants[0].rows.length).toBe(TRIOS_PER_VARIANT);
    expect(view.variants[0].moreLabel).toBe('2 more trios not shown.');
    expect(view.variants[0].summary).toContain(`${TRIOS_PER_VARIANT + 2} trios together`);
  });

  it('has no "more" line when every trio is listed', () => {
    const view = ready(
      buildTripleSupportView(triosOf([trio(['loki', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 20, 10)]), 10.5, identities),
    );

    expect(view.variants[0].moreLabel).toBeNull();
  });

  it('draws a hero the roster lacks under its id spelled out, never dropping the trio', () => {
    const view = ready(
      buildTripleSupportView(triosOf([trio(['new-hero', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 20, 10)]), 10.5, identities),
    );

    expect(view.variants[0].rows[0].heroes[0]).toEqual(
      jasmine.objectContaining({ name: 'New Hero', imageUrl: '/images/heroes/new-hero.png' }),
    );
  });

  it('skips a trio whose counts are not numbers', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([
          trio(['loki', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 20, 10, { wins: Number.NaN }),
          trio(['luna-snow', 'mantis', 'loki'], MANTIS_TRIPLE, 20, 10, { teams: 0 }),
          trio(['luna-snow', 'mantis', 'loki'], THREE_HEALERS, 20, 10),
        ]),
        10.5,
        identities,
      ),
    );

    expect(view.variants.map(({ label }) => label)).toEqual([THREE_HEALERS]);
  });

  it('shows the Quad support count out of the classified teams', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([trio(['loki', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 20, 10)], { classifiedTeams: 200, fourPlusTeams: 3 }),
        10.5,
        identities,
      ),
    );

    expect(view.quadSupport).toEqual({ label: '3 of 200 teams (1.5%)' });
  });

  it('shows no Quad support line when no team is classified', () => {
    const view = ready(
      buildTripleSupportView(
        triosOf([trio(['loki', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 20, 10)], { classifiedTeams: 0 }),
        10.5,
        identities,
      ),
    );

    expect(view.quadSupport).toBeNull();
  });

  it('says nothing about the half-season when it is the one the page shows', () => {
    const view = ready(
      buildTripleSupportView(triosOf([trio(['loki', 'luna-snow', 'mantis'], MANTIS_TRIPLE, 20, 10)]), 10.5, identities),
    );

    expect(view.notice).toBeNull();
  });

  it('names its own half-season when the previous one stands in for the current one', () => {
    const view = buildTripleSupportView(triosOf([], { halfSeason: season(10), inPlaceOf: season(10.5) }), 10.5, identities);

    expect(view).toEqual(
      jasmine.objectContaining({
        notice:
          "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
      }),
    );
  });

  it('names its own half-season when it differs from the page without a fall-back', () => {
    const view = buildTripleSupportView(triosOf([], { halfSeason: season(10) }), 10.5, identities);

    expect(view).toEqual(jasmine.objectContaining({ notice: "Triple supports are Season 10's numbers." }));
  });
});
