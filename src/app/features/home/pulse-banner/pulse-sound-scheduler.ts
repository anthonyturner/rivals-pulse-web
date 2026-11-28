import { cuesInWindow } from '../../../core/circuit/loop-cues';
import { PULSE_CUES, PulseCue } from './pulse-cues';
import { PulseLoopClock } from './pulse-loop-clock';

/** Where sound is made: an audio clock to schedule against, and a way to sound a cue at a time on it. */
export interface PulseCueSink {
  /** The audio clock, in seconds. */
  now(): number;
  play(cue: PulseCue, atSeconds: number): void;
  /** Silences anything still scheduled. */
  close(): void;
}

const TICK_MS = 50;
/** How far ahead each tick schedules; it has to outlast a late tick, and stays short so a pause cuts the sound off in step. */
const LOOKAHEAD_MS = 200;

/**
 * Sounds the banner's cues as the animation loop reaches them. Each tick it reads the animation's
 * clock, then schedules every cue due in the next moment on the audio clock, which is far steadier
 * than a timer. Reading the animation each time is what keeps sound from drifting from the picture.
 * A tick that runs late skips the cues it missed instead of playing them out of step.
 */
export class PulseSoundScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private scheduledTo: number | null = null;

  constructor(
    private readonly clock: Pick<PulseLoopClock, 'read'>,
    private readonly sink: PulseCueSink,
  ) {}

  start(): void {
    if (this.timer !== null) return;
    this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  /** Stops for good and silences what was scheduled; a banner that plays again makes a new scheduler. */
  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.sink.close();
  }

  tick(): void {
    const reading = this.clock.read();
    if (!reading) return;
    const { loopMs, positionMs } = reading;
    const from = Math.max(positionMs, this.scheduledTo ?? positionMs);
    const to = positionMs + LOOKAHEAD_MS;
    const audioNow = this.sink.now();
    for (const { cue, atMs } of cuesInWindow(PULSE_CUES, loopMs, from, to)) {
      this.sink.play(cue, audioNow + (atMs - positionMs) / 1000);
    }
    this.scheduledTo = Math.max(to, this.scheduledTo ?? to);
  }
}
