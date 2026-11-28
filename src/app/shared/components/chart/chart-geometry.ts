/** Where `value` sits between `min` and `max`, as a percentage held to 0 to 100. A range with no width puts everything at the start. */
export function positionOf(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || max <= min) {
    return 0;
  }

  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

export interface AxisWindow {
  min: number;
  max: number;
}

/**
 * A range that holds every value and the `anchor` (for example the 50% line), padded by `pad` and
 * rounded outwards to a multiple of `step`, so the axis ends on a round number. It is never narrower
 * than `minSpan`, and never leaves `floor` to `ceiling`. Nothing to measure gives the anchor's window.
 */
export function axisWindow(
  values: readonly number[],
  options: { anchor: number; pad: number; step: number; minSpan: number; floor: number; ceiling: number },
): AxisWindow {
  const { anchor, pad, step, minSpan, floor, ceiling } = options;
  const finite = values.filter(Number.isFinite);
  let min = Math.floor((Math.min(anchor, ...finite) - pad) / step) * step;
  let max = Math.ceil((Math.max(anchor, ...finite) + pad) / step) * step;

  while (max - min < minSpan && (min > floor || max < ceiling)) {
    if (min > floor && min - floor >= ceiling - max) {
      min -= step;
    } else {
      max += step;
    }
  }

  return { min: Math.max(floor, min), max: Math.min(ceiling, max) };
}

/** The values from `min` to `max` in steps of `step`, `max` included when it falls on one. */
export function axisValues(min: number, max: number, step: number): number[] {
  if (step <= 0 || max < min) {
    return [];
  }

  const count = Math.floor((max - min) / step + 1e-9);

  return Array.from({ length: count + 1 }, (_, index) => min + index * step);
}

/**
 * The widths, as percentages that add up to 100, of the segments of a bar whose parts are `values`. A
 * part that is negative or not a number counts as nothing, and no parts at all give no segments.
 */
export function segmentWidths(values: readonly number[]): number[] {
  const parts = values.map((value) => (Number.isFinite(value) && value > 0 ? value : 0));
  const total = parts.reduce((sum, part) => sum + part, 0);

  return total === 0 ? [] : parts.map((part) => (part / total) * 100);
}
