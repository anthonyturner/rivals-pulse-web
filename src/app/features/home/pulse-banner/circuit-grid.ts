/** Whether the grid animates, holds its picture until it may animate again, or shows one still frame. */
export type CircuitPlayback = 'playing' | 'paused' | 'still';

/** The colours the grid draws with; canvas cannot follow CSS variables, so the owner reads them from the theme. */
export interface CircuitPalette {
  readonly line: string;
  /** Pulses take these in turn. */
  readonly currents: readonly [string, string, string];
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
const MAX_AMBIENT_PULSES = 14;
const AMBIENT_SPAWN_GAP_S = 0.35;
const TURN_CHANCE = 0.35;
/** The wait before each surge is drawn from this range; it counts down only while the grid plays. */
const AMBIENT_SURGE_MIN_S = 6;
const AMBIENT_SURGE_MAX_S = 12;
const MAX_FRAME_S = 0.05;
const GRID_LINE_ALPHA = 0.55;
/** The trail fades in this many steps: fewer strokes per pulse than one per segment. */
const TRAIL_BANDS = 4;
const STILL_PULSES = 6;
const STILL_STEPS = 40;
const STILL_STEP_S = 0.016;

/**
 * The banner's circuit board: a faint grid with pulses of current racing along its lines and leaving
 * fading trails, drawn on a canvas it owns and animated outside Angular's change detection (it keeps
 * plain fields, and the app is zoneless, so a frame never triggers a check). Every few seconds
 * while it plays, a stronger pulse crosses the grid in one straight line. Playback is the owner's
 * decision: it knows whether the window is visible and whether the player asked for less motion.
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

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private palette: CircuitPalette,
    private readonly random: () => number = Math.random,
  ) {
    this.ambientSurgeTimer = this.nextAmbientSurgeGap();
  }

  /** The stronger pulses still on the grid. */
  get strongPulses(): number {
    return this.pulses.filter(pulse => pulse.strong).length;
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

    if (playback === 'still') {
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
    this.advance(Math.min(MAX_FRAME_S, elapsed));
    this.render();
    this.frame = requestAnimationFrame(next => this.tick(next));
  }

  private advance(seconds: number): void {
    this.spawnTimer -= seconds;
    this.ambientSurgeTimer -= seconds;
    if (this.ambientSurgeTimer <= 0) {
      this.spawnSurge();
      this.ambientSurgeTimer = this.nextAmbientSurgeGap();
    }
    if (this.spawnTimer <= 0 && this.pulses.filter(pulse => !pulse.strong).length < MAX_AMBIENT_PULSES) {
      this.spawnAmbient();
      this.spawnTimer = AMBIENT_SPAWN_GAP_S;
    }
    this.pulses = this.pulses.filter(pulse => pulse.life > 0);
    for (const pulse of this.pulses) this.step(pulse, seconds);
  }

  private nextAmbientSurgeGap(): number {
    return AMBIENT_SURGE_MIN_S + this.random() * (AMBIENT_SURGE_MAX_S - AMBIENT_SURGE_MIN_S);
  }

  private spawnAmbient(): void {
    this.pulses.push({
      x: Math.round(this.width / 2 / CELL) * CELL,
      y: Math.round(this.height / 2 / CELL) * CELL,
      dx: this.random() < 0.5 ? -1 : 1,
      dy: 0,
      trail: [],
      trailLength: 26,
      colour: this.spawned++ % 3,
      speed: 140 + this.random() * 80,
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
      speed: 460,
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
      if (!pulse.strong && this.random() < TURN_CHANCE) {
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

  private renderStill(): void {
    this.pulses = [];
    for (let i = 0; i < STILL_PULSES; i++) this.spawnAmbient();
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
    for (const pulse of this.pulses) this.drawPulse(ctx, pulse);
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = GRID_LINE_ALPHA;
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
    ctx.shadowBlur = pulse.strong ? 18 : 10;
    ctx.lineWidth = pulse.strong ? 3.5 : 2;

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
