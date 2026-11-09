import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { ReducedMotionService } from '../../../core/accessibility/reduced-motion.service';
import { ThemeService } from '../../../core/theme/theme.service';
import { CircuitGrid, CircuitPalette, CircuitPlayback } from './circuit-grid';
import { PulseAudioService } from './pulse-audio.service';
import { PulseLoopClock } from './pulse-loop-clock';
import { PulseSoundScheduler } from './pulse-sound-scheduler';

/** A framed strip of its own, or the whole backdrop of the box that holds it (the owner positions that box). */
export type PulseBannerLayout = 'strip' | 'backdrop';

/**
 * The Rivals Pulse name across the top of the home hero: a gold and a periwinkle heartbeat collide
 * under it and throw an orchid spark, over a circuit grid with currents racing along it. It is
 * decoration, so only the name is announced. The server renders the still frame; the browser starts
 * the motion, and holds it still when the tab is hidden, the banner is off screen, or the visitor asked
 * for reduced motion. As a backdrop the grid fills the whole hero; the clash keeps a band of the
 * height the owner gives it in `--pulse-stage-height`, so its drawing is not stretched tall.
 *
 * While it plays, a pointer over it pulls the currents toward it, and each collision sends a
 * shockwave across the grid. With `sound` on it also sounds the heartbeats and the clash, timed
 * from the animation itself; that is silent unless the owner turns it on, and never in reduced motion.
 *
 * The owner sets the size with two custom properties: `--pulse-banner-height`, the strip's height
 * (128px when unset), and `--pulse-stage-height`, the backdrop's clash band (200px when unset).
 */
@Component({
  selector: 'app-pulse-banner',
  templateUrl: './pulse-banner.component.html',
  styleUrl: './pulse-banner.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-layout]': 'layout()' },
})
export class PulseBannerComponent {
  readonly layout = input<PulseBannerLayout>('strip');
  /** Whether the visitor has asked to hear it. */
  readonly sound = input(false);

  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService).theme;
  private readonly reducedMotion = inject(ReducedMotionService).reduced;
  private readonly audio = inject(PulseAudioService);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('grid');
  private readonly spark = viewChild<ElementRef<HTMLElement>>('spark');
  private readonly grid = signal<CircuitGrid | null>(null);
  private readonly loopClock = new PulseLoopClock(() => this.spark()?.nativeElement ?? null);

  private onScreen = false;
  private updatePlayback: () => void = () => undefined;
  private scheduler: PulseSoundScheduler | null = null;

  protected readonly playback = signal<CircuitPlayback>('still');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) return;
      const grid = new CircuitGrid(this.canvas().nativeElement, this.readPalette());
      grid.setClash({ clock: this.loopClock, origin: () => this.sparkCentre() });
      this.watchSize(grid, view, destroyRef);
      this.watchPlayback(grid, destroyRef);
      this.watchPointer(grid, destroyRef);
      destroyRef.onDestroy(() => {
        this.setSounding(false);
        grid.destroy();
      });
      this.grid.set(grid);
    });

    // Canvas cannot follow CSS variables, so a theme change re-reads the palette.
    effect(() => {
      this.theme();
      const grid = this.grid();
      if (grid) untracked(() => grid.setPalette(this.readPalette()));
    });

    effect(() => {
      this.reducedMotion();
      untracked(() => this.updatePlayback());
    });

    // Sound follows the picture: only while it plays, and only once the browser lets audio start.
    effect(() => {
      const wanted = this.sound() && this.playback() === 'playing';
      const ready = this.audio.ready();
      untracked(() => {
        if (wanted && !ready) this.audio.unlockOnNextGesture();
        this.setSounding(wanted && ready);
      });
    });
  }

  private setSounding(on: boolean): void {
    if (!on) {
      this.scheduler?.stop();
      this.scheduler = null;
    } else if (!this.scheduler) {
      const sink = this.audio.open();
      if (!sink) return;
      this.scheduler = new PulseSoundScheduler(this.loopClock, sink);
      this.scheduler.start();
    }
  }

  private watchSize(grid: CircuitGrid, view: Window, destroyRef: DestroyRef): void {
    const resize = (): void => {
      const { width, height } = this.host.nativeElement.getBoundingClientRect();
      grid.resize(width, height, view.devicePixelRatio || 1);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(this.host.nativeElement);
    destroyRef.onDestroy(() => observer.disconnect());
  }

  private watchPlayback(grid: CircuitGrid, destroyRef: DestroyRef): void {
    this.updatePlayback = (): void => {
      const next: CircuitPlayback = this.reducedMotion()
        ? 'still'
        : this.onScreen && !this.document.hidden ? 'playing' : 'paused';
      grid.setPlayback(next);
      this.playback.set(next);
    };
    const update = (): void => this.updatePlayback();

    const observer = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(this.host.nativeElement);

    this.document.addEventListener('visibilitychange', update);
    destroyRef.onDestroy(() => {
      observer.disconnect();
      this.document.removeEventListener('visibilitychange', update);
    });
    update();
  }

  /**
   * The pointer is read from the page, not from the banner: as a backdrop it lets every click through
   * to the copy over it. Touch is left out, since a finger dragging to scroll is not hovering.
   */
  private watchPointer(grid: CircuitGrid, destroyRef: DestroyRef): void {
    const move = (event: PointerEvent): void => {
      if (event.pointerType === 'touch' || this.playback() !== 'playing') return;
      const box = this.host.nativeElement.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const inside = x >= 0 && y >= 0 && x <= box.width && y <= box.height;
      grid.setPointer(inside ? { x, y } : null);
    };
    const leave = (): void => grid.setPointer(null);

    const root = this.document.documentElement;
    this.document.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerleave', leave);
    destroyRef.onDestroy(() => {
      this.document.removeEventListener('pointermove', move);
      root.removeEventListener('pointerleave', leave);
    });
  }

  /** Where the collision is on the canvas: the spark sits on it, and it scales about its centre. */
  private sparkCentre(): readonly [number, number] {
    const host = this.host.nativeElement.getBoundingClientRect();
    const spark = this.spark()?.nativeElement.getBoundingClientRect();
    return spark ? [spark.left + spark.width / 2 - host.left, spark.top + spark.height / 2 - host.top] : [host.width / 2, host.height / 2];
  }

  /** The hero stays dark in both themes, so the banner reads the fixed `--ink-*` tokens of that band. */
  private readPalette(): CircuitPalette {
    const style = getComputedStyle(this.host.nativeElement);
    const read = (name: string): string => style.getPropertyValue(name).trim();
    return {
      line: read('--ink-line'),
      currents: [read('--ink-accent'), read('--ink-secondary'), read('--ink-tertiary')],
    };
  }
}
