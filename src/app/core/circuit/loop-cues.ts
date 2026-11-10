/** Where an animation loop stands: its length, and how far the animation has run (not wrapped to one loop). */
export interface LoopReading {
  readonly loopMs: number;
  readonly positionMs: number;
}

/** Something that happens at one place in the loop. `at` is a fraction of the loop, so it follows the loop's length. */
export interface LoopCue {
  readonly at: number;
}

export interface TimedCue<Cue extends LoopCue> {
  readonly cue: Cue;
  readonly atMs: number;
}

/** Every time a cue comes round in `[fromMs, toMs)` of the animation's own clock, soonest first. */
export function cuesInWindow<Cue extends LoopCue>(cues: readonly Cue[], loopMs: number, fromMs: number, toMs: number): TimedCue<Cue>[] {
  if (!(loopMs > 0) || toMs <= fromMs) return [];
  const due: TimedCue<Cue>[] = [];
  for (const cue of cues) {
    const offset = cue.at * loopMs;
    for (let loop = Math.ceil((fromMs - offset) / loopMs); loop * loopMs + offset < toMs; loop++) {
      due.push({ cue, atMs: loop * loopMs + offset });
    }
  }
  return due.sort((a, b) => a.atMs - b.atMs);
}
