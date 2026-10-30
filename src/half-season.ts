import type { HeroStatsHalfSeason } from './contracts/hero-stats.model.js';

/** One row of `half_seasons`: when a half-season began. Its end is the next half-season's start. */
export interface HalfSeasonStart {
  halfSeason: number;
  startsAt: string;
}

/** The half-seasons the aggregates know, shared by every community number that is split by half-season. */
export interface HalfSeasonTimeline {
  /** Every half-season that has started, oldest first: the seasons a client can ask for. */
  started: readonly number[];
  describe: (id: number) => HeroStatsHalfSeason;
}

export interface HalfSeasonChoice {
  shown?: number;
  /** Set only when `shown` is the previous half-season, standing in for this current one. */
  inPlaceOf?: number;
}

/**
 * `countedIds` are the half-seasons that have counts, so one with counts but no `half_seasons` row
 * is still known. The current half-season is the latest that has started, or the latest known when
 * no start date says.
 */
export function buildHalfSeasonTimeline(
  starts: readonly HalfSeasonStart[],
  countedIds: Iterable<number>,
  now: Date,
): HalfSeasonTimeline {
  const startOf = new Map(starts.map((season) => [season.halfSeason, season.startsAt]));
  const known = [...new Set([...startOf.keys(), ...countedIds])].sort((a, b) => a - b);
  const hasStarted = (id: number): boolean => {
    const start = Date.parse(startOf.get(id) ?? '');

    return !Number.isNaN(start) && start <= now.getTime();
  };
  const current = known.filter(hasStarted).at(-1) ?? known.at(-1);

  return {
    started: current === undefined ? [] : known.filter((id) => id <= current),
    describe: (id) => {
      const next = known.find((other) => other > id && startOf.has(other));

      return {
        id,
        label: `Season ${id}`,
        startsAt: startOf.get(id) ?? null,
        endsAt: next === undefined ? null : (startOf.get(next) ?? null),
      };
    },
  };
}

/**
 * Which half-season to show. With `requested`, exactly that one (no fall-back): a half-season that
 * has not started, or that nothing knows, shows none. Without it, the current one, or the previous
 * one while the current is not `isReady` and the previous is.
 */
export function chooseHalfSeason(
  timeline: HalfSeasonTimeline,
  requested: number | undefined,
  isReady: (id: number) => boolean,
): HalfSeasonChoice {
  const { started } = timeline;

  if (requested !== undefined) {
    return started.includes(requested) ? { shown: requested } : {};
  }

  const current = started.at(-1);
  const previous = started.at(-2);

  if (current !== undefined && previous !== undefined && !isReady(current) && isReady(previous)) {
    return { shown: previous, inPlaceOf: current };
  }

  return { shown: current };
}
