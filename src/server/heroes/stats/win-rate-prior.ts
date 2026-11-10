/** Wins out of matches. Counts only; whose record it is (a hero's, a pair's) is the caller's business. */
export interface WinRecord {
  readonly matches: number;
  readonly wins: number;
}

/** A Beta prior for a win rate: `strength` pretend matches played at `mean` (0 to 1). */
export interface RatePrior {
  readonly mean: number;
  readonly strength: number;
}

/** A record's win rate (0 to 1) once the prior is added, and the range it most likely lies in. */
export interface RateEstimate {
  readonly rate: number;
  readonly low: number;
  readonly high: number;
}

/** A record, plus the group (a hero's role) whose average it is pulled toward when that group is known. */
export interface GroupedRecord extends WinRecord {
  readonly group?: string | null;
}

export interface WinRatePriors {
  /** Pretend matches every prior carries. */
  readonly strength: number;
  /** False when there were too few records to estimate `strength` from and `FALLBACK_PRIOR_STRENGTH` stands in. */
  readonly estimated: boolean;
  /** The prior for a record in `group`: that group's average, else the overall average. */
  priorFor(group?: string | null): RatePrior;
  /** `record` under `priorFor(group)`: its pulled-in rate and the `CREDIBLE_LEVEL` range around it. */
  estimate(record: WinRecord, group?: string | null): RateEstimate;
}

/** The weakest and strongest prior ever used, so a tiny or oddly even sample cannot switch the pull off or freeze every rate. */
export const MIN_PRIOR_STRENGTH = 10;
export const MAX_PRIOR_STRENGTH = 500;
/** Stands in when there are too few records to estimate from; close to the spread the community file measured (about 59). */
export const FALLBACK_PRIOR_STRENGTH = 60;
/** Records the spread must be measured over; fewer and the fallback stands in, centred on 50%. */
export const MIN_RECORDS_TO_ESTIMATE = 5;
/** A group needs this many records for its own average; a smaller one is pulled toward the overall average. */
export const MIN_GROUP_RECORDS = 3;
/** How much of a record's likely range `RateEstimate` spans (0.8 is 80%). */
export const CREDIBLE_LEVEL = 0.8;
/** Standard normal quantile for the upper edge of `CREDIBLE_LEVEL`. */
const Z_FOR_LEVEL = 1.2816;

const NEUTRAL_MEAN = 0.5;

/** `record` pulled toward `prior.mean` as if `prior.strength` more matches had been played at that rate. */
export function shrunkRate({ matches, wins }: WinRecord, { mean, strength }: RatePrior): number {
  return (wins + strength * mean) / (matches + strength);
}

/**
 * Learns how hard to pull a record toward its average from the records being ranked: the further apart the real
 * win rates are, the more a short record can be trusted. This is the Beta-binomial method of moments: the spread
 * seen across records is the real spread plus the luck each record's length allows, so taking the luck out leaves
 * the real spread, and `strength = mean * (1 - mean) / spread - 1`. Records weigh by their matches, so a hero
 * seen once barely counts.
 *
 * The strength stays between `MIN_PRIOR_STRENGTH` and `MAX_PRIOR_STRENGTH`; a spread that luck alone explains
 * gives the maximum; too few records give `FALLBACK_PRIOR_STRENGTH` around 50%. A group of at least
 * `MIN_GROUP_RECORDS` records has its own average (a role's); every other record uses the overall one.
 */
export function estimateWinRatePriors(records: readonly GroupedRecord[]): WinRatePriors {
  const played = records.filter(({ matches, wins }) => matches > 0 && wins >= 0 && wins <= matches);
  const overall = pooledMean(played) ?? NEUTRAL_MEAN;
  const { groups, rest } = splitByGroup(played);
  const buckets = rest.length >= MIN_GROUP_RECORDS ? [...groups.values(), rest] : [...groups.values()];

  const estimated = buckets.reduce((total, bucket) => total + bucket.length, 0) >= MIN_RECORDS_TO_ESTIMATE;
  const strength = estimated ? strengthFromSpread(buckets) : FALLBACK_PRIOR_STRENGTH;
  const fallbackMean = estimated ? overall : NEUTRAL_MEAN;

  const priorFor = (group?: string | null): RatePrior => {
    const members = estimated && group ? groups.get(group) : undefined;
    return { mean: (members && pooledMean(members)) ?? fallbackMean, strength };
  };

  return {
    strength,
    estimated,
    priorFor,
    estimate: (record, group) => posterior(record, priorFor(group)),
  };
}

/** Groups of at least `MIN_GROUP_RECORDS` records, and everything else (no group, or a group too small) as `rest`. */
function splitByGroup(records: readonly GroupedRecord[]): { groups: Map<string, GroupedRecord[]>; rest: GroupedRecord[] } {
  const named = new Map<string, GroupedRecord[]>();
  const rest: GroupedRecord[] = [];
  for (const record of records) {
    if (record.group) named.set(record.group, [...(named.get(record.group) ?? []), record]);
    else rest.push(record);
  }

  const groups = new Map<string, GroupedRecord[]>();
  for (const [group, members] of named) {
    if (members.length >= MIN_GROUP_RECORDS) groups.set(group, members);
    else rest.push(...members);
  }
  return { groups, rest };
}

function pooledMean(records: readonly WinRecord[]): number | undefined {
  const matches = records.reduce((total, record) => total + record.matches, 0);
  return matches > 0 ? records.reduce((total, record) => total + record.wins, 0) / matches : undefined;
}

/**
 * Each bucket is measured against its own average. Its squared gaps, weighted by matches, add up to the real
 * spread times `matches - sum(matches^2) / matches`, plus the luck `mean * (1 - mean) * (records - 1)` (Kleinman's
 * moment estimator). Summing the buckets and dividing isolates the real spread.
 */
function strengthFromSpread(buckets: readonly (readonly WinRecord[])[]): number {
  let excess = 0;
  let room = 0;
  let luckTotal = 0;
  let matchesTotal = 0;

  for (const bucket of buckets) {
    const matches = bucket.reduce((total, record) => total + record.matches, 0);
    const mean = pooledMean(bucket) ?? NEUTRAL_MEAN;
    const squaredGaps = bucket.reduce((total, record) => total + record.matches * (record.wins / record.matches - mean) ** 2, 0);
    const luck = mean * (1 - mean);
    excess += squaredGaps - luck * (bucket.length - 1);
    room += matches - bucket.reduce((total, record) => total + record.matches ** 2, 0) / matches;
    luckTotal += luck * matches;
    matchesTotal += matches;
  }

  const spread = excess / room;
  if (!(spread > 0)) return MAX_PRIOR_STRENGTH;
  return Math.min(MAX_PRIOR_STRENGTH, Math.max(MIN_PRIOR_STRENGTH, luckTotal / matchesTotal / spread - 1));
}

/** The Beta posterior of `prior` plus `record`; its range uses a normal curve, which is close once the prior and record together pass ten matches. */
function posterior(record: WinRecord, prior: RatePrior): RateEstimate {
  const wins = prior.strength * prior.mean + record.wins;
  const losses = prior.strength * (1 - prior.mean) + (record.matches - record.wins);
  const total = wins + losses;
  const rate = wins / total;
  const margin = Z_FOR_LEVEL * Math.sqrt((wins * losses) / (total * total * (total + 1)));
  return { rate, low: Math.max(0, rate - margin), high: Math.min(1, rate + margin) };
}
