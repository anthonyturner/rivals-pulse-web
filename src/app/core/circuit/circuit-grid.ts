import { LoopReading, cuesInWindow } from './loop-cues';

/** Whether the grid animates, holds its picture until it may animate again, or shows one still frame. */
export type CircuitPlayback = 'playing' | 'paused' | 'still';

/** The colours the grid draws with; canvas cannot follow CSS variables, so the owner reads them from the theme. */
export interface CircuitPalette {
  readonly line: string;
  /** Pulses take these in turn. */
  readonly currents: readonly [string, string, string];
}

/** How the grid moves and looks. Each knob is relative to the lively look the home banner has. */
export interface CircuitLook {
  /** Scales how fast pulses travel. */
  readonly speed: number;
  /** Scales how many ordinary pulses the grid holds. */
  readonly density: number;
  /** Scales the width of a pulse's stroke. */
  readonly weight: number;
  /** Scales the glow around a pulse. */
  readonly glow: number;
  /** How opaque the plain grid lines are, 0 to 1. */
  readonly gridAlpha: number;
  /** Whether a stronger pulse crosses the grid every few seconds. */
  readonly surges: boolean;
  /** Whether pulses start where the banner's heartbeats collide, rather than at any crossing. */
  readonly startAtCentre: boolean;
}

export const LIVELY_LOOK: CircuitLook = { speed: 1, density: 1, weight: 1, glow: 1, gridAlpha: 0.55, surges: true, startAtCentre: true };

/** Behind other content: slower, sparser, thinner and with less glow, and nothing that crosses the whole grid at once. */
export const CALM_LOOK: CircuitLook = { speed: 0.5, density: 0.5, weight: 0.75, glow: 0.5, gridAlpha: 0.5, surges: false, startAtCentre: false };

/** Tells the grid when the banner's two heartbeats collide, and where, so each collision sends a shockwave across it. */
export interface ClashSource {
  readonly clock: { read(): LoopReading | null };
  /** Where the collision falls in the loop, as a fraction of it. */
  readonly at: number;
  /** Where the collision is on the canvas, in CSS pixels. */
  origin(): readonly [number, number];
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface Shockwave extends Point {
  age: number;
}

interface Pulse {
  x: number;
  y: number;
  dx: number;
  dy: number;
  trail: [number, number][];
  trailLength: number;
  colour: number;
  speed: number;
  travelled: number;
  life: number;
  strong: boolean;
}

const CELL = 24;
/** The strip's size: 14 ambient pulses and one new one every 0.35 s are what it looks right with. */
const STRIP_AREA = 1320 * 128;
const STRIP_AMBIENT_PULSES = 14;
const STRIP_SPAWN_GAP_S = 0.35;
/** A bigger grid has proportionally more pulses, up to this many: each is several glowing strokes a frame. */
const MAX_AMBIENT_PULSES = 32;
const TURN_CHANCE = 0.35;
/** The wait before each surge is drawn from this range; it counts down only while the grid plays. */
const AMBIENT_SURGE_MIN_S = 6;
const AMBIENT_SURGE_MAX_S = 12;
const MAX_FRAME_S = 0.05;
/** The trail fades in this many steps: fewer strokes per pulse than one per segment. */
const TRAIL_BANDS = 4;
/** The still frame's pulses, for a grid the size of the strip. */
const STILL_PULSES = 6;
const STILL_STEPS = 40;
const STILL_STEP_S = 0.016;
/** The pointer bends pulses within this distance, and brightens the grid lines inside it. */
const POINTER_REACH = 150;
/** The most likely a pulse right beside the pointer is to turn toward it at a crossing; it fades to none at the edge of the reach. */
const POINTER_PULL = 0.9;
const POINTER_GLOW_ALPHA = 0.55;
const SHOCKWAVE_S = 1.1;
const SHOCKWAVE_SPEED = 700;
/** How wide the band of grid lines lit by the front of a shockwave is. */
const SHOCKWAVE_BAND = 70;
const SHOCKWAVE_GLOW_ALPHA = 0.7;
/** Lit lines are drawn in this many steps of brightness, one stroke each, rather than one stroke per line. */
const GLOW_BANDS = 4;

/**
 * A circuit board: a faint grid with pulses of current racing along its lines and leaving
 * fading trails, drawn on a canvas it owns and animated outside Angular's change detection (it keeps
 * plain fields, and the app is zoneless, so a frame never triggers a check). Every few seconds
 * while it plays, a stronger pulse crosses the grid in one straight line. A pointer set with
 * `setPointer` pulls nearby pulses toward it and lights the lines around it, and each collision
 * reported by the `ClashSource` sends a shockwave outward. Playback is the owner's decision: it knows
 * whether the window is visible and whether the player asked for less motion, and the pointer and
 * the shockwaves show only while the grid plays.
 */
export class CircuitGrid {
  private width = 0;
  private height = 0;
  private pulses: Pulse[] = [];
  private playback: CircuitPlayback = 'paused';
  private frame = 0;
  private lastFrameAt = 0;
  private spawnTimer = 0;
  private ambientSurgeTimer: number;
  private spawned = 0;
  private surgesFired = 0;
  private pointer: Point | null = null;
  private shockwaves: Shockwave[] = [];
  private clash: ClashSource | null = null;
  private lastLoopPositionMs: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private palette: CircuitPalette,
    private readonly random: () => number = Math.random,
    private readonly look: CircuitLook = LIVELY_LOOK,
  ) {
    this.ambientSurgeTimer = this.nextAmbientSurgeGap();
  }

  /** The ordinary pulses still on the grid. */
  get ambientPulses(): number {
    return this.pulses.filter(pulse => !pulse.strong).length;
  }

  /** The stronger pulses still on the grid. */
  get strongPulses(): number {
    return this.pulses.filter(pulse => pulse.strong).length;
  }

  /** Where the pointer is on the canvas, in CSS pixels, or null once it has gone. Ignored unless the grid is playing. */
  setPointer(point: Point | null): void {
    this.pointer = this.playback === 'playing' ? point : null;
  }

  setClash(clash: ClashSource | null): void {
    this.clash = clash;
    this.lastLoopPositionMs = null;
  }

  /** The shockwaves still travelling across the grid. */
  get activeShockwaves(): number {
    return this.shockwaves.length;
  }

  setPalette(palette: CircuitPalette): void {
    this.palette = palette;
    this.redrawIfNotPlaying();
  }

  /** Sizes the canvas to `width` x `height` CSS pixels at `pixelRatio`. */
  resize(width: number, height: number, pixelRatio: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = Math.round(width * pixelRatio);
    this.canvas.height = Math.round(height * pixelRatio);
    this.context()?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (this.playback === 'still') this.renderStill();
    else this.redrawIfNotPlaying();
  }

  setPlayback(playback: CircuitPlayback): void {
    if (playback === this.playback) return;
    this.playback = playback;
    this.stopLoop();
    this.lastLoopPositionMs = null;
    if (playback !== 'playing') this.pointer = null;

    if (playback === 'still') {
      this.shockwaves = [];
      this.renderStill();
    } else if (playback === 'playing') {
      this.lastFrameAt = 0;
      this.frame = requestAnimationFrame(now => this.tick(now));
    }
  }

  destroy(): void {
    this.stopLoop();
    this.pulses = [];
  }

  private tick(now: number): void {
    const elapsed = this.lastFrameAt ? (now - this.lastFrameAt) / 1000 : 0;
    this.lastFrameAt = now;
    this.watchForClash();
    this.advance(Math.min(MAX_FRAME_S, elapsed));
    this.render();
    this.frame = requestAnimationFrame(next => this.tick(next));
  }

  private advance(seconds: number): void {
    this.spawnTimer -= seconds;
    if (this.look.surges) {
      this.ambientSurgeTimer -= seconds;
      if (this.ambientSurgeTimer <= 0) {
        this.spawnSurge();
        this.ambientSurgeTimer = this.nextAmbientSurgeGap();
      }
    }
    if (this.spawnTimer <= 0 && this.ambientPulses < this.ambientCapacity) {
      this.spawnAmbient();
      this.spawnTimer = STRIP_SPAWN_GAP_S * ((STRIP_AMBIENT_PULSES * this.look.density) / this.ambientCapacity);
    }
    this.pulses = this.pulses.filter(pulse => pulse.life > 0);
    for (const pulse of this.pulses) this.step(pulse, seconds);
    for (const wave of this.shockwaves) wave.age += seconds;
    this.shockwaves = this.shockwaves.filter(wave => wave.age < SHOCKWAVE_S);
  }

  /** A shockwave leaves the collision each time the banner's loop passes it. */
  private watchForClash(): void {
    const reading = this.clash?.clock.read();
    if (!this.clash || !reading) return;
    if (this.lastLoopPositionMs !== null) {
      const passed = cuesInWindow([{ at: this.clash.at }], reading.loopMs, this.lastLoopPositionMs, reading.positionMs);
      if (passed.length > 0) {
        const [x, y] = this.clash.origin();
        this.shockwaves.push({ x, y, age: 0 });
      }
    }
    this.lastLoopPositionMs = reading.positionMs;
  }

  private nextAmbientSurgeGap(): number {
    return AMBIENT_SURGE_MIN_S + this.random() * (AMBIENT_SURGE_MAX_S - AMBIENT_SURGE_MIN_S);
  }

  /** How many ordinary pulses the grid holds: the strip's number at the strip's size, more in proportion to a bigger area, never fewer. */
  get ambientCapacity(): number {
    const scaled = Math.round((STRIP_AMBIENT_PULSES * this.width * this.height) / STRIP_AREA);
    const lively = Math.min(MAX_AMBIENT_PULSES, Math.max(STRIP_AMBIENT_PULSES, scaled));
    return Math.max(1, Math.round(lively * this.look.density));
  }

  /**
   * Pulses start at the centre, where the heartbeat in the banner collides. On a grid bigger than the
   * strip that would leave the rest empty, so the share of the area beyond the strip's decides how
   * often one starts at a random crossing instead. The strip itself never does. A look that does not
   * start at the centre has no collision to start from, so every pulse starts at a random crossing.
   */
  private spawnPoint(): [number, number] {
    const beyondStrip = this.look.startAtCentre ? Math.max(0, 1 - STRIP_AREA / Math.max(1, this.width * this.height)) : 1;
    if (beyondStrip > 0 && this.random() < beyondStrip) {
      return [Math.round((this.random() * this.width) / CELL) * CELL, Math.round((this.random() * this.height) / CELL) * CELL];
    }
    return [Math.round(this.width / 2 / CELL) * CELL, Math.round(this.height / 2 / CELL) * CELL];
  }

  private spawnAmbient(): void {
    const [x, y] = this.spawnPoint();
    this.pulses.push({
      x,
      y,
      dx: this.random() < 0.5 ? -1 : 1,
      dy: 0,
      trail: [],
      trailLength: 26,
      colour: this.spawned++ % 3,
      speed: (140 + this.random() * 80) * this.look.speed,
      travelled: 0,
      life: 1,
      strong: false,
    });
  }

  private spawnSurge(): void {
    const fromLeft = this.surgesFired++ % 2 === 0;
    const rows = Math.max(1, Math.floor(this.height / CELL));
    this.pulses.push({
      x: fromLeft ? 0 : this.width,
      y: Math.floor(this.random() * rows) * CELL,
      dx: fromLeft ? 1 : -1,
      dy: 0,
      trail: [],
      trailLength: 36,
      colour: this.spawned++ % 3,
      speed: 460 * this.look.speed,
      travelled: 0,
      life: 1,
      strong: true,
    });
  }

  private step(pulse: Pulse, seconds: number): void {
    const move = pulse.speed * seconds;
    pulse.travelled += move;
    pulse.x += pulse.dx * move;
    pulse.y += pulse.dy * move;

    if (pulse.travelled >= CELL) {
      pulse.travelled = 0;
      pulse.x = Math.round(pulse.x / CELL) * CELL;
      pulse.y = Math.round(pulse.y / CELL) * CELL;
      const pulled = pulse.strong ? null : this.towardPointer(pulse);
      if (pulled) {
        [pulse.dx, pulse.dy] = pulled;
      } else if (!pulse.strong && this.random() < TURN_CHANCE) {
        const sign = this.random() < 0.5 ? -1 : 1;
        if (pulse.dy === 0) {
          pulse.dy = sign;
          pulse.dx = 0;
        } else {
          pulse.dx = sign;
          pulse.dy = 0;
        }
      }
    }

    pulse.trail.push([pulse.x, pulse.y]);
    if (pulse.trail.length > pulse.trailLength) pulse.trail.shift();
    const outside = pulse.x < -CELL || pulse.x > this.width + CELL || pulse.y < -CELL || pulse.y > this.height + CELL;
    if (outside) pulse.life -= seconds * 2;
  }

  /**
   * At a crossing near the pointer, the way to turn toward it: whichever of ahead, left and right
   * leads closest, never back the way it came. Null leaves the pulse to its usual turning, which also
   * lets a pulse that has reached the pointer wander off again.
   */
  private towardPointer(pulse: Pulse): [number, number] | null {
    if (!this.pointer) return null;
    const toX = this.pointer.x - pulse.x;
    const toY = this.pointer.y - pulse.y;
    const distance = Math.hypot(toX, toY);
    if (distance > POINTER_REACH || distance < CELL / 2) return null;
    if (this.random() >= POINTER_PULL * (1 - distance / POINTER_REACH)) return null;

    let best: [number, number] | null = null;
    let bestScore = -Infinity;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (dx === -pulse.dx && dy === -pulse.dy) continue;
      const score = dx * toX + dy * toY;
      if (score > bestScore) {
        bestScore = score;
        best = [dx, dy];
      }
    }
    return best;
  }

  private renderStill(): void {
    this.pulses = [];
    const count = Math.round((STILL_PULSES * this.ambientCapacity) / STRIP_AMBIENT_PULSES);
    for (let i = 0; i < count; i++) this.spawnAmbient();
    for (const pulse of this.pulses) {
      for (let step = 0; step < STILL_STEPS; step++) this.step(pulse, STILL_STEP_S);
    }
    this.render();
  }

  private redrawIfNotPlaying(): void {
    if (this.playback !== 'playing') this.render();
  }

  private render(): void {
    const ctx = this.context();
    if (!ctx) return;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawGrid(ctx);
    if (this.pointer) {
      this.lightLines(ctx, this.pointer, POINTER_REACH, distance => 1 - distance / POINTER_REACH, this.palette.currents[0], POINTER_GLOW_ALPHA);
    }
    for (const wave of this.shockwaves) this.drawShockwave(ctx, wave);
    for (const pulse of this.pulses) this.drawPulse(ctx, pulse);
  }

  /** The ring of a shockwave, and the grid lines its front is passing, both fading as it goes. */
  private drawShockwave(ctx: CanvasRenderingContext2D, wave: Shockwave): void {
    const radius = wave.age * SHOCKWAVE_SPEED;
    const fade = 1 - wave.age / SHOCKWAVE_S;
    const colour = this.palette.currents[2];
    const strength = (distance: number): number => Math.max(0, 1 - Math.abs(distance - radius) / SHOCKWAVE_BAND) * fade;
    this.lightLines(ctx, wave, radius + SHOCKWAVE_BAND, strength, colour, SHOCKWAVE_GLOW_ALPHA);

    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.6 * fade;
    ctx.beginPath();
    ctx.arc(wave.x, wave.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  /**
   * Draws the grid lines within `reach` of `centre` over the plain grid, each cell-long stretch as
   * bright as `strength` says of its distance from the centre (0 to 1; 0 draws nothing).
   */
  private lightLines(
    ctx: CanvasRenderingContext2D,
    centre: Point,
    reach: number,
    strength: (distance: number) => number,
    colour: string,
    alpha: number,
  ): void {
    const bands = Array.from({ length: GLOW_BANDS }, () => new Path2D());
    const light = (x1: number, y1: number, x2: number, y2: number): void => {
      const weight = strength(Math.hypot((x1 + x2) / 2 - centre.x, (y1 + y2) / 2 - centre.y));
      if (weight <= 0) return;
      const band = bands[Math.min(GLOW_BANDS - 1, Math.floor(weight * GLOW_BANDS))];
      band.moveTo(x1, y1);
      band.lineTo(x2, y2);
    };

    const left = Math.max(0, centre.x - reach);
    const right = Math.min(this.width, centre.x + reach);
    const top = Math.max(0, centre.y - reach);
    const bottom = Math.min(this.height, centre.y + reach);
    for (let x = 0.5 + Math.ceil((left - 0.5) / CELL) * CELL; x < right; x += CELL) {
      for (let y = Math.floor(top / CELL) * CELL; y < bottom; y += CELL) light(x, y, x, y + CELL);
    }
    for (let y = 0.5 + Math.ceil((top - 0.5) / CELL) * CELL; y < bottom; y += CELL) {
      for (let x = Math.floor(left / CELL) * CELL; x < right; x += CELL) light(x, y, x + CELL, y);
    }

    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    bands.forEach((path, band) => {
      ctx.globalAlpha = (alpha * (band + 1)) / GLOW_BANDS;
      ctx.stroke(path);
    });
    ctx.globalAlpha = 1;
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = this.look.gridAlpha;
    ctx.strokeStyle = this.palette.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0.5; x < this.width; x += CELL) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0.5; y < this.height; y += CELL) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawPulse(ctx: CanvasRenderingContext2D, pulse: Pulse): void {
    const { trail } = pulse;
    const colour = this.palette.currents[pulse.colour];
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.shadowBlur = (pulse.strong ? 18 : 10) * this.look.glow;
    ctx.lineWidth = (pulse.strong ? 3.5 : 2) * this.look.weight;

    const segments = trail.length - 1;
    for (let band = 0; band < TRAIL_BANDS; band++) {
      const from = Math.floor((segments * band) / TRAIL_BANDS);
      const to = Math.floor((segments * (band + 1)) / TRAIL_BANDS);
      if (to <= from) continue;
      ctx.globalAlpha = ((band + 1) / TRAIL_BANDS) * pulse.life;
      ctx.beginPath();
      ctx.moveTo(trail[from][0], trail[from][1]);
      for (let i = from + 1; i <= to; i++) ctx.lineTo(trail[i][0], trail[i][1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  private stopLoop(): void {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private context(): CanvasRenderingContext2D | null {
    return this.canvas.getContext('2d');
  }
}
