import {
  CREDIBLE_LEVEL, FALLBACK_PRIOR_STRENGTH, GroupedRecord, MAX_PRIOR_STRENGTH, MIN_GROUP_RECORDS, MIN_PRIOR_STRENGTH,
  MIN_RECORDS_TO_ESTIMATE, estimateWinRatePriors, shrunkRate,
} from './win-rate-prior';

/**
 * Every hero's [appearances, wins] in the all-ranks band of the overlay's bundled community file (Season 10.5,
 * rivals_pulse commit b05fa85), so the overlay's spec and this one measure the same spread.
 */
const OVERLAY_COMMUNITY_RECORDS: readonly (readonly [number, number])[] = [
  [28, 10], [61, 23], [19, 13], [31, 14], [13, 7], [224, 148], [34, 22], [24, 10], [35, 17],
  [93, 49], [60, 24], [150, 59], [24, 13], [25, 15], [34, 20], [41, 25], [57, 26], [137, 65],
  [66, 21], [21, 9], [51, 25], [46, 27], [97, 52], [61, 32], [170, 97], [38, 19], [30, 22],
  [84, 47], [54, 33], [34, 18], [36, 21], [105, 40], [20, 12], [136, 59], [40, 21], [18, 11],
  [137, 69], [36, 19], [29, 11], [89, 41], [76, 40], [15, 7], [105, 42], [105, 52], [103, 54],
  [49, 17], [112, 60], [22, 15], [109, 46], [74, 34], [220, 118], [53, 28], [74, 27], [40, 23],
];

/** A repeatable stream of numbers in 0 to 1 (mulberry32), so the synthetic data never changes between runs. */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Heroes whose real rates spread by `spread` around `mean`, each played `matches` times, with the luck of a real sample. */
function syntheticHeroes(count: number, matches: number, mean: number, spread: number, group?: string): GroupedRecord[] {
  const random = seededRandom(count * 7919 + matches);
  const normal = (): number => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  return Array.from({ length: count }, () => {
    const real = Math.min(0.95, Math.max(0.05, mean + spread * normal()));
    const wins = Array.from({ length: matches }, () => random() < real).filter(Boolean).length;
    return { matches, wins, group };
  });
}

/** The strength a Beta prior needs for real rates to spread by `spread` around `mean`. */
const strengthFor = (mean: number, spread: number): number => (mean * (1 - mean)) / spread ** 2 - 1;

describe('shrunkRate', () => {
  it('adds the strength as pretend matches at the prior mean', () => {
    expect(shrunkRate({ matches: 100, wins: 70 }, { mean: 0.5, strength: 10 })).toBeCloseTo(75 / 110, 10);
    expect(shrunkRate({ matches: 20, wins: 10 }, { mean: 0.6, strength: 30 })).toBeCloseTo(28 / 50, 10);
  });

  it('is exactly the prior mean for a hero with no matches', () => {
    expect(shrunkRate({ matches: 0, wins: 0 }, { mean: 0.54, strength: 60 })).toBeCloseTo(0.54, 10);
  });
});

describe('estimateWinRatePriors', () => {
  describe('the strength', () => {
    it('recovers the spread the heroes were generated with', () => {
      const priors = estimateWinRatePriors(syntheticHeroes(600, 120, 0.5, 0.065));

      expect(priors.estimated).toBeTrue();
      expect(priors.strength).toBeGreaterThan(strengthFor(0.5, 0.065) * 0.8);
      expect(priors.strength).toBeLessThan(strengthFor(0.5, 0.065) * 1.25);
    });

    it('tells a wider spread from a narrower one', () => {
      const wide = estimateWinRatePriors(syntheticHeroes(600, 120, 0.5, 0.12));
      const narrow = estimateWinRatePriors(syntheticHeroes(600, 120, 0.5, 0.04));

      expect(wide.strength).toBeLessThan(strengthFor(0.5, 0.12) * 1.25);
      expect(narrow.strength).toBeGreaterThan(strengthFor(0.5, 0.04) * 0.6);
      expect(narrow.strength).toBeGreaterThan(wide.strength * 4);
    });

    it('still finds the spread when the heroes were played very different amounts', () => {
      const heroes = [...syntheticHeroes(300, 15, 0.5, 0.065), ...syntheticHeroes(300, 60, 0.5, 0.065), ...syntheticHeroes(200, 250, 0.5, 0.065)];
      const { strength } = estimateWinRatePriors(heroes);

      expect(strength).toBeGreaterThan(strengthFor(0.5, 0.065) * 0.7);
      expect(strength).toBeLessThan(strengthFor(0.5, 0.065) * 1.4);
    });

    it('is at the ceiling when the records differ by no more than luck', () => {
      const even = [30, 50, 80, 120, 200].map(matches => ({ matches, wins: matches / 2 }));

      expect(estimateWinRatePriors(even).strength).toBe(MAX_PRIOR_STRENGTH);
    });

    it('is at the floor when the records are far apart', () => {
      const apart = [{ matches: 50, wins: 50 }, { matches: 50, wins: 0 }, { matches: 50, wins: 49 }, { matches: 50, wins: 1 }, { matches: 50, wins: 25 }];

      expect(estimateWinRatePriors(apart).strength).toBe(MIN_PRIOR_STRENGTH);
    });

    it('uses the fallback around 50% when there are too few records', () => {
      const few = Array.from({ length: MIN_RECORDS_TO_ESTIMATE - 1 }, () => ({ matches: 40, wins: 36 }));
      const priors = estimateWinRatePriors(few);

      expect(priors.estimated).toBeFalse();
      expect(priors.strength).toBe(FALLBACK_PRIOR_STRENGTH);
      expect(priors.priorFor()).toEqual({ mean: 0.5, strength: FALLBACK_PRIOR_STRENGTH });
    });

    it('uses the fallback for no records at all, and ignores records with no matches or impossible counts', () => {
      const junk = [{ matches: 0, wins: 0 }, { matches: 10, wins: 11 }, { matches: 10, wins: -1 }];

      expect(estimateWinRatePriors([]).strength).toBe(FALLBACK_PRIOR_STRENGTH);
      expect(estimateWinRatePriors(junk).estimated).toBeFalse();
    });

    it('starts estimating at the minimum number of records', () => {
      const enough = Array.from({ length: MIN_RECORDS_TO_ESTIMATE }, (_, index) => ({ matches: 50, wins: 20 + index * 3 }));

      expect(estimateWinRatePriors(enough).estimated).toBeTrue();
    });
  });

  describe('the mean', () => {
    it('is the matches-weighted overall average when no group is given', () => {
      const heroes = [{ matches: 100, wins: 60 }, { matches: 100, wins: 40 }, { matches: 50, wins: 35 }, { matches: 20, wins: 10 }, { matches: 30, wins: 15 }];

      expect(estimateWinRatePriors(heroes).priorFor().mean).toBeCloseTo(160 / 300, 10);
    });

    it('is each group\'s own average where the group has enough records, else the overall one', () => {
      const tanks = syntheticHeroes(MIN_GROUP_RECORDS + 3, 100, 0.56, 0.05, 'Vanguard');
      const damage = syntheticHeroes(MIN_GROUP_RECORDS + 3, 100, 0.46, 0.05, 'Duelist');
      const lone = [{ matches: 100, wins: 80, group: 'Strategist' }];
      const priors = estimateWinRatePriors([...tanks, ...damage, ...lone]);

      const pooled = (records: GroupedRecord[]): number => records.reduce((total, r) => total + r.wins, 0) / records.reduce((total, r) => total + r.matches, 0);
      expect(priors.priorFor('Vanguard').mean).toBeCloseTo(pooled(tanks), 10);
      expect(priors.priorFor('Duelist').mean).toBeCloseTo(pooled(damage), 10);
      expect(priors.priorFor('Strategist').mean).toBe(priors.priorFor().mean);
      expect(priors.priorFor('Not a role').mean).toBe(priors.priorFor().mean);
      expect(priors.priorFor(null).mean).toBe(priors.priorFor().mean);
    });

    it('measures the spread inside each group, so groups with different averages do not look like spread', () => {
      const tanks = syntheticHeroes(150, 100, 0.6, 0.05, 'Vanguard');
      const damage = syntheticHeroes(150, 100, 0.4, 0.05, 'Duelist');
      const together = estimateWinRatePriors([...tanks, ...damage]);
      const ignoringGroups = estimateWinRatePriors([...tanks, ...damage].map(({ matches, wins }) => ({ matches, wins })));

      expect(together.strength).toBeGreaterThan(strengthFor(0.5, 0.05) * 0.7);
      expect(together.strength).toBeLessThan(strengthFor(0.5, 0.05) * 1.4);
      expect(ignoringGroups.strength).toBeLessThan(together.strength / 2);
    });
  });

  describe('estimate', () => {
    const priors = estimateWinRatePriors(syntheticHeroes(1500, 100, 0.5, 0.065));

    it('pulls a record toward the prior mean by the strength', () => {
      const { rate } = priors.estimate({ matches: 20, wins: 13 });

      expect(rate).toBeCloseTo(shrunkRate({ matches: 20, wins: 13 }, priors.priorFor()), 10);
    });

    it('keeps a 13-7 run out of A tier with the spread of the overlay community file', () => {
      const heroes = OVERLAY_COMMUNITY_RECORDS.map(([matches, wins]) => ({ matches, wins }));
      const community = estimateWinRatePriors(heroes);

      expect(community.strength).toBeCloseTo(58.70, 2);
      expect(community.estimate({ matches: 20, wins: 13 }).rate).toBeLessThan(0.56);
    });

    it('is exactly the prior mean, with a wide range, for a hero with no matches', () => {
      const { rate, low, high } = priors.estimate({ matches: 0, wins: 0 });

      expect(rate).toBeCloseTo(priors.priorFor().mean, 10);
      expect(high - low).toBeGreaterThan(0.1);
    });

    it('brackets the rate, narrower for a longer record', () => {
      const short = priors.estimate({ matches: 20, wins: 10 });
      const long = priors.estimate({ matches: 400, wins: 200 });

      expect(short.low).toBeLessThan(short.rate);
      expect(short.high).toBeGreaterThan(short.rate);
      expect(long.high - long.low).toBeLessThan(short.high - short.low);
    });

    it('holds the real rate in its range about as often as CREDIBLE_LEVEL says', () => {
      const random = seededRandom(99);
      const normal = (): number => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
      let covered = 0;
      const trials = 2000;
      for (let trial = 0; trial < trials; trial++) {
        const real = Math.min(0.95, Math.max(0.05, 0.5 + 0.065 * normal()));
        const wins = Array.from({ length: 40 }, () => random() < real).filter(Boolean).length;
        const { low, high } = priors.estimate({ matches: 40, wins });
        if (real >= low && real <= high) covered++;
      }

      expect(covered / trials).toBeGreaterThan(CREDIBLE_LEVEL - 0.06);
      expect(covered / trials).toBeLessThan(CREDIBLE_LEVEL + 0.06);
    });

    it('stays between 0 and 1', () => {
      const sure = priors.estimate({ matches: 500, wins: 500 });

      expect(sure.high).toBeLessThanOrEqual(1);
      expect(priors.estimate({ matches: 500, wins: 0 }).low).toBeGreaterThanOrEqual(0);
    });

    it('uses the group average when given a group', () => {
      const grouped = estimateWinRatePriors([...syntheticHeroes(8, 100, 0.6, 0.04, 'Vanguard'), ...syntheticHeroes(8, 100, 0.4, 0.04, 'Duelist')]);

      expect(grouped.estimate({ matches: 20, wins: 10 }, 'Vanguard').rate).toBeGreaterThan(grouped.estimate({ matches: 20, wins: 10 }, 'Duelist').rate);
    });
  });
});
