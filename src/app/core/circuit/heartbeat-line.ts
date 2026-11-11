import type { CircuitPlayback } from './circuit-grid';
import type { StageSurface } from './playback-stage';

/** The calm range a beat rate is held to, whatever the upload volume: busy never reads as a racing pulse, quiet never as flat. */
export const MIN_BEATS_PER_MINUTE = 36;
export const MAX_BEATS_PER_MINUTE = 72;
/** Where in the range the line sits when there is no volume to read. */
export const RESTING_BEATS_PER_MINUTE = 48;
/** The matches a day at which the beat reaches the top of its range. */
const BUSIEST_MATCHES_PER_DAY = 1000;

/** One heartbeat as `[phase, deflection]` points, phase 0 to 1 across the beat and deflection -1 to 1 (up is positive): a small P wave, the QRS spike, then a T wave. */
const BEAT: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.1, 0],
  [0.15, 0.12],
  [0.2, 0],
  [0.27, 0],
  [0.29, -0.15],
  [0.315, 1],
  [0.34, -0.3],
  [0.365, 0],
  [0.45, 0],
  [0.55, 0.25],
  [0.65, 0],
  [1, 0],
];

const SPEED_PX_PER_S = 70;
const SAMPLE_PX = 2;
const MAX_FRAME_S = 0.05;
/** The beat a still frame holds, so its spike sits in view. */
const STILL_BEATS = 0.35;

export interface HeartbeatPalette {
  readonly line: string;
}

/**
 * The beat rate that reflects how many matches players upload in a day, on a log scale between
 * the calm limits. `null` (no volume known yet) rests in the middle.
 */
export function heartbeatRate(matchesPerDay: number | null): number {
  if (matchesPerDay === null || !Number.isFinite(matchesPerDay)) return RESTING_BEATS_PER_MINUTE;

  const share = Math.log10(1 + Math.max(0, matchesPerDay)) / Math.log10(1 + BUSIEST_MATCHES_PER_DAY);
  const rate = MIN_BEATS_PER_MINUTE + Math.min(1, share) * (MAX_BEATS_PER_MINUTE - MIN_BEATS_PER_MINUTE);

  return Math.round(rate);
}

/** How far the line leaves its baseline at `phase` of a beat (any real number; it wraps), -1 to 1. */
export function ecgDeflection(phase: number): number {
  const at = phase - Math.floor(phase);
  const next = BEAT.findIndex(([point]) => point >= at);
  if (next <= 0) return BEAT[0][1];

  const [fromPhase, from] = BEAT[next - 1];
  const [toPhase, to] = BEAT[next];

  return from + ((to - from) * (at - fromPhase)) / (toPhase - fromPhase);
}

/**
 * An ECG-style line drawn on a canvas it owns: a heartbeat trace that scrolls across, faded at both
 * ends, with the gap between beats set by `setRate`. Like the circuit grid it keeps plain fields and
 * runs outside change detection, and playback is the owner's call: `paused` holds the picture and
 * `still` shows one frame.
 */
export class HeartbeatLine implements StageSurface {
  private width = 0;
  private height = 0;
  private playback: CircuitPlayback = 'paused';
  private frame = 0;
  private lastFrameAt = 0;
  /** How many beats have scrolled past, so a change of rate never jumps the line. */
  private beats = STILL_BEATS;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private palette: HeartbeatPalette,
    private rate: number = RESTING_BEATS_PER_MINUTE,
  ) {}

  setRate(beatsPerMinute: number): void {
    this.rate = beatsPerMinute;
    this.redrawIfNotPlaying();
  }

  setPalette(palette: HeartbeatPalette): void {
    this.palette = palette;
    this.redrawIfNotPlaying();
  }

  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.context()?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    this.redrawIfNotPlaying();
  }

  setPlayback(playback: CircuitPlayback): void {
    if (playback === this.playback) return;
    this.playback = playback;
    this.stopLoop();

    if (playback === 'still') {
      this.beats = STILL_BEATS;
      this.render();
    } else if (playback === 'playing') {
      this.lastFrameAt = 0;
      this.frame = requestAnimationFrame((now) => this.tick(now));
    }
  }

  destroy(): void {
    this.stopLoop();
  }

  private tick(now: number): void {
    const elapsed = this.lastFrameAt ? Math.min(MAX_FRAME_S, (now - this.lastFrameAt) / 1000) : 0;
    this.lastFrameAt = now;
    this.beats += (elapsed * this.rate) / 60;
    this.render();
    this.frame = requestAnimationFrame((next) => this.tick(next));
  }

  private redrawIfNotPlaying(): void {
    if (this.playback !== 'playing') this.render();
  }

  private render(): void {
    const ctx = this.context();
    if (!ctx || this.width <= 0 || this.height <= 0) return;

    ctx.clearRect(0, 0, this.width, this.height);
    const beatPx = (SPEED_PX_PER_S * 60) / this.rate;
    const baseline = this.height * 0.72;
    const amplitude = this.height * 0.38;

    ctx.beginPath();
    for (let x = 0; x <= this.width; x += SAMPLE_PX) {
      const y = baseline - amplitude * ecgDeflection(x / beatPx + this.beats);
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = this.palette.line;
    ctx.shadowColor = this.palette.line;
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // The trace leaves and enters through a fade, not a hard edge.
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(0, 0, this.width, 0);
    fade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    fade.addColorStop(0.18, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(0.82, 'rgba(0, 0, 0, 1)');
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  private stopLoop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private context(): CanvasRenderingContext2D | null {
    return this.canvas.getContext('2d');
  }
}
