import { LoopCue } from '../../../core/circuit/loop-cues';

export type PulseCueKind = 'lub' | 'dub' | 'crack' | 'boom';

/** One sound in the loop, at a fraction of it so it follows `--loop` without knowing its length. */
export interface PulseCue extends LoopCue {
  readonly kind: PulseCueKind;
  /** The stereo side it plays from: the pulse that makes it, or the centre for the clash. */
  readonly side: 'left' | 'right' | 'centre';
}

/** The collision, as the 55% keyframe of the banner's stylesheet. */
const COLLISION_AT = 0.55;

/** The crack at the collision, which the grid's shockwave also follows. */
export const COLLISION_CUE: PulseCue = { kind: 'crack', side: 'centre', at: COLLISION_AT };

/** Where each pulse is at 55% of the loop, in the stylesheet's `pulse-banner-window-*` keyframes: the window has crossed half of the 1000-unit drawing. */
const WINDOW_TRAVEL = 500;
/** The easing of the first 55% of those keyframes, `cubic-bezier(0.55, 0, 0.9, 0.6)`. */
const WINDOW_EASING: readonly [number, number, number, number] = [0.55, 0, 0.9, 0.6];

/** The point along a cubic Bezier easing curve, for the parameter `u` (0 to 1). */
function bezier(u: number, p1: number, p2: number): number {
  const inverse = 1 - u;
  return 3 * inverse * inverse * u * p1 + 3 * inverse * u * u * p2 + u * u * u;
}

/** How far into the easing's time (0 to 1) a window has covered `progress` of its travel; the curve rises, so bisection finds it. */
function easingTimeAt(progress: number): number {
  const [x1, y1, x2, y2] = WINDOW_EASING;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 32; step++) {
    const mid = (low + high) / 2;
    if (bezier(mid, y1, y2) < progress) low = mid;
    else high = mid;
  }
  return bezier((low + high) / 2, x1, x2);
}

/**
 * The loop fraction at which a pulse's leading edge reaches `x` of the drawing's 1000 units, counted
 * from its own end. The pulses cover the first half in the first 55% of the loop and meet in the middle.
 */
function reaches(x: number): number {
  return easingTimeAt(x / WINDOW_TRAVEL) * COLLISION_AT;
}

/**
 * The heartbeat is voiced as each pulse's leading edge passes the first two bumps of its spike (x is
 * the distance from the pulse's end in the stylesheet's drawing); the clash cracks at the collision
 * and the boom follows a breath behind. `pulse-banner.component.spec.ts` checks these against the real animation.
 */
export const PULSE_CUES: readonly PulseCue[] = [
  { kind: 'lub', side: 'left', at: reaches(208) },
  { kind: 'dub', side: 'left', at: reaches(240) },
  { kind: 'lub', side: 'right', at: reaches(222) },
  { kind: 'dub', side: 'right', at: reaches(256) },
  COLLISION_CUE,
  { kind: 'boom', side: 'centre', at: COLLISION_AT + 0.006 },
];
