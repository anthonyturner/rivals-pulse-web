import { JARVIS_STATE_LOOKS, type JarvisState, type JarvisStateLook } from './jarvis-console.data';

type Rgb = readonly [number, number, number];

const ALLY: Rgb = [60, 242, 166];
const ENEMY: Rgb = [255, 93, 115];
const GOLD: Rgb = [255, 201, 77];

/** Beads on the orbit ring: six allies, six enemies, as in a Rivals match. */
const BEAD_COUNT = 12;
const TRACE_LENGTH = 150;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface CorePoint {
  x: number;
  y: number;
  z: number;
  /** Per-point jitter seed, so speaking does not ripple in lockstep. */
  jitter: number;
}

interface ProjectedPoint {
  sx: number;
  sy: number;
  z: number;
  /** 0 at the ally edge, 1 at the enemy edge, used to pick the point colour. */
  side: number;
}

/**
 * Draws the Jarvis core: a particle sphere of ally-to-enemy coloured points, a
 * ring of twelve player beads, and an ECG trace that reacts to the voice level.
 *
 * Ported from the approved landing mockup rather than re-derived, so the motion
 * matches what was signed off. Owns nothing but the canvas it is handed.
 */
export class JarvisCoreRenderer {
  private readonly context: CanvasRenderingContext2D;
  private readonly points: readonly CorePoint[];
  private readonly links: readonly number[][];
  private readonly trace = new Array<number>(TRACE_LENGTH).fill(0);
  private readonly look: JarvisStateLook = { ...JARVIS_STATE_LOOKS.idle };
  private readonly resizeObserver?: ResizeObserver;

  private state: JarvisState = 'idle';
  private level = 0;
  private targetLevel = 0;
  private rotation = 0.6;
  private lastFrame = 0;
  private beat = 0;
  private width = 0;
  private height = 0;
  private frameHandle?: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly reduceMotion: boolean,
    pointCount: number,
  ) {
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('The Jarvis core needs a 2D canvas context.');
    }

    this.context = context;
    this.points = buildSpherePoints(pointCount);
    this.links = buildNearestNeighbourLinks(this.points);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.measure());
      this.resizeObserver.observe(canvas);
    }

    this.measure();
  }

  start(): void {
    if (this.frameHandle !== undefined) {
      return;
    }

    this.lastFrame = performance.now();
    this.frameHandle = requestAnimationFrame((now) => this.frame(now));
  }

  stop(): void {
    if (this.frameHandle !== undefined) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = undefined;
    }
  }

  destroy(): void {
    this.stop();
    this.resizeObserver?.disconnect();
  }

  setState(state: JarvisState): void {
    this.state = state;
  }

  /** 0 to 1: how loudly the core is hearing or speaking right now. */
  setLevel(level: number): void {
    this.targetLevel = Math.min(1, Math.max(0, level));
  }

  private measure(): void {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();

    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  private frame(now: number): void {
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;

    const target = JARVIS_STATE_LOOKS[this.state];
    const ease = Math.min(1, delta * 4);
    this.look.swell += (target.swell - this.look.swell) * ease;
    this.look.gold += (target.gold - this.look.gold) * ease;
    this.look.spin += (target.spin - this.look.spin) * ease;
    this.level += (this.targetLevel - this.level) * Math.min(1, delta * 10);

    if (!this.reduceMotion) {
      this.rotation += delta * 0.42 * this.look.spin;
    }

    this.draw(now, delta);
    this.frameHandle = requestAnimationFrame((next) => this.frame(next));
  }

  private draw(now: number, delta: number): void {
    const ctx = this.context;
    const w = this.width;
    const h = this.height;

    if (w === 0 || h === 0) {
      return;
    }

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h * 0.45;
    const breath = this.reduceMotion ? 0 : Math.sin(now / 1100) * 0.012;
    const radius = Math.min(w, h) * 0.27 * (1 + breath + this.look.swell * (0.4 + this.level));

    this.drawGlow(cx, cy, radius);

    const projected = this.project(cx, cy, radius, now);
    this.drawLinks(projected);
    this.drawPoints(projected);
    this.drawBeads(cx, cy, radius, now);
    this.drawThinkingArcs(cx, cy, radius, now);
    this.drawTrace(delta, now);
  }

  private drawGlow(cx: number, cy: number, radius: number): void {
    const ctx = this.context;
    const outer = radius * 1.5;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, outer);

    gradient.addColorStop(0, rgba(GOLD, 0.22 + this.look.gold * 0.35 + this.level * 0.2));
    gradient.addColorStop(0.35, 'rgba(120, 90, 230, 0.14)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, 0, Math.PI * 2);
    ctx.fill();
  }

  private project(
    cx: number,
    cy: number,
    radius: number,
    now: number,
  ): readonly ProjectedPoint[] {
    const cosR = Math.cos(this.rotation);
    const sinR = Math.sin(this.rotation);
    const cosT = Math.cos(0.32);
    const sinT = Math.sin(0.32);
    const speaking = this.state === 'speaking' && !this.reduceMotion;

    return this.points.map((point) => {
      const x = point.x * cosR + point.z * sinR;
      const spun = -point.x * sinR + point.z * cosR;
      const y = point.y * cosT - spun * sinT;
      const z = point.y * sinT + spun * cosT;
      const scale = 3 / (3 + z);
      const jitter = speaking ? Math.sin(now / 90 + point.jitter * 20) * 0.02 * this.level : 0;

      return {
        sx: cx + x * radius * scale * (1 + jitter),
        sy: cy + y * radius * scale * (1 + jitter),
        z,
        side: (point.x + 1) / 2,
      };
    });
  }

  private drawLinks(projected: readonly ProjectedPoint[]): void {
    const ctx = this.context;
    ctx.lineWidth = 0.7;

    for (let i = 0; i < projected.length; i++) {
      for (const target of this.links[i]) {
        const a = projected[i];
        const b = projected[target];
        const depth = (2 - (a.z + b.z) / 2) / 2;

        ctx.strokeStyle = rgba(mix(ALLY, ENEMY, (a.side + b.side) / 2), 0.08 + depth * 0.28);
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }
    }
  }

  private drawPoints(projected: readonly ProjectedPoint[]): void {
    const ctx = this.context;

    for (const point of projected) {
      const depth = (1 - point.z) / 2;

      ctx.fillStyle = rgba(mix(ALLY, ENEMY, point.side), 0.35 + depth * 0.6);
      ctx.beginPath();
      ctx.arc(point.sx, point.sy, 0.8 + depth * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawBeads(cx: number, cy: number, radius: number, now: number): void {
    const ctx = this.context;
    const rx = radius * 1.55;
    const ry = radius * 0.42;
    const spin = this.reduceMotion ? 0.4 : (now / 9000) * this.look.spin;
    const tilt = -0.18;
    const half = BEAD_COUNT / 2;

    ctx.strokeStyle = 'rgba(170, 190, 220, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, tilt, 0, Math.PI * 2);
    ctx.stroke();

    for (let i = 0; i < BEAD_COUNT; i++) {
      const ally = i < half;
      const angle = spin + (ally ? i * 0.22 : Math.PI + (i - half) * 0.22);
      const bx = Math.cos(angle) * rx;
      const by = Math.sin(angle) * ry;
      const x = cx + bx * Math.cos(tilt) - by * Math.sin(tilt);
      const y = cy + bx * Math.sin(tilt) + by * Math.cos(tilt);
      const front = Math.sin(angle) > 0;
      const colour = ally ? ALLY : ENEMY;

      ctx.fillStyle = rgba(colour, front ? 0.95 : 0.35);
      ctx.shadowColor = rgba(colour, 0.8);
      ctx.shadowBlur = front ? 10 : 0;
      ctx.beginPath();
      ctx.arc(x, y, front ? 4 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }

  private drawThinkingArcs(cx: number, cy: number, radius: number, now: number): void {
    if (this.look.gold <= 0.6) {
      return;
    }

    const ctx = this.context;
    ctx.strokeStyle = rgba(GOLD, (this.look.gold - 0.6) * 2);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    for (let i = 0; i < 3; i++) {
      const start = now / 400 + i * 2.094;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.22, start, start + 0.7);
      ctx.stroke();
    }
  }

  private drawTrace(delta: number, now: number): void {
    const ctx = this.context;
    const w = this.width;
    const h = this.height;

    this.beat += delta;

    let value = 0;
    if (this.state === 'speaking') {
      value = (Math.random() - 0.5) * 1.6 * this.level;
    } else if (this.state === 'listening') {
      value = (Math.random() - 0.5) * 0.9 * this.level;
    } else if (this.state === 'thinking') {
      value = Math.sin(now / 60) * 0.25;
    }

    // The heartbeat spike keeps its own cadence, whatever is being said over it.
    if (this.beat > 1.1) {
      this.beat = 0;
      this.trace.push(-0.35, 1.25, -0.9, 0.3);
    }

    if (!this.reduceMotion) {
      this.trace.push(value);
    }

    while (this.trace.length > TRACE_LENGTH) {
      this.trace.shift();
    }

    const baseline = h * 0.86;
    const lineWidth = w * 0.7;
    const left = (w - lineWidth) / 2;
    const amplitude = h * 0.05;
    const gradient = ctx.createLinearGradient(left, 0, left + lineWidth, 0);

    gradient.addColorStop(0, rgba(ALLY, 0));
    gradient.addColorStop(0.2, rgba(ALLY, 0.8));
    gradient.addColorStop(0.5, rgba(GOLD, 0.95));
    gradient.addColorStop(0.8, rgba(ENEMY, 0.8));
    gradient.addColorStop(1, rgba(ENEMY, 0));

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.beginPath();

    this.trace.forEach((point, index) => {
      const x = left + (index / (this.trace.length - 1)) * lineWidth;
      const y = baseline - point * amplitude;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();
  }
}

/** Fibonacci sphere, so points spread evenly instead of bunching at the poles. */
function buildSpherePoints(count: number): readonly CorePoint[] {
  const points: CorePoint[] = [];

  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const ring = Math.sqrt(1 - y * y);
    const theta = i * GOLDEN_ANGLE;

    points.push({
      x: Math.cos(theta) * ring,
      y,
      z: Math.sin(theta) * ring,
      jitter: Math.random(),
    });
  }

  return points;
}

function buildNearestNeighbourLinks(points: readonly CorePoint[]): readonly number[][] {
  return points.map((point, index) =>
    points
      .map((other, otherIndex) => ({
        index: otherIndex,
        distance: (point.x - other.x) ** 2 + (point.y - other.y) ** 2 + (point.z - other.z) ** 2,
      }))
      .filter((candidate) => candidate.index !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)
      .map((candidate) => candidate.index),
  );
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ];
}

function rgba(colour: Rgb, alpha: number): string {
  return `rgba(${colour[0]}, ${colour[1]}, ${colour[2]}, ${alpha})`;
}
