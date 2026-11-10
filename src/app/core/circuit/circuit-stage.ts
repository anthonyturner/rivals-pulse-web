import { DestroyRef, signal } from '@angular/core';

import { CircuitGrid, CircuitLook, CircuitPalette, CircuitPlayback, LIVELY_LOOK } from './circuit-grid';

export interface CircuitStageOptions {
  /** The box the circuit fills: it is measured for the canvas's size and watched for being on screen. */
  readonly host: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly document: Document;
  readonly look?: CircuitLook;
  /** Read again by `refreshPalette`, since canvas cannot follow CSS variables. */
  readonly palette: () => CircuitPalette;
  /** Whether the visitor asked for less motion, which holds one still frame. */
  readonly reducedMotion: () => boolean;
  /** Whether the circuit has a place to show; false holds its picture without drawing frames. Always on unless set. */
  readonly enabled?: () => boolean;
}

/**
 * A `CircuitGrid` with its playback wiring: it sizes the canvas to its host, plays only while the
 * host is on screen, the tab is visible and the circuit is enabled, and holds one still frame in
 * reduced motion. The owner calls `refreshPlayback` when `reducedMotion` or `enabled` change.
 * Create it in the browser only, since it needs the canvas and the observers.
 */
export class CircuitStage {
  readonly grid: CircuitGrid;
  readonly playback = signal<CircuitPlayback>('still');

  private onScreen = false;

  constructor(private readonly options: CircuitStageOptions, destroyRef: DestroyRef) {
    const { host, canvas, document } = options;
    const view = document.defaultView;
    this.grid = new CircuitGrid(canvas, options.palette(), Math.random, options.look ?? LIVELY_LOOK);

    const resize = (): void => {
      const { width, height } = host.getBoundingClientRect();
      this.grid.resize(width, height, view?.devicePixelRatio || 1);
    };
    resize();
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(host);

    const screenObserver = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      this.refreshPlayback();
    });
    screenObserver.observe(host);

    const refresh = (): void => this.refreshPlayback();
    document.addEventListener('visibilitychange', refresh);

    destroyRef.onDestroy(() => {
      sizeObserver.disconnect();
      screenObserver.disconnect();
      document.removeEventListener('visibilitychange', refresh);
      this.grid.destroy();
    });
    this.refreshPlayback();
  }

  refreshPlayback(): void {
    const { reducedMotion, enabled = () => true, document } = this.options;
    const next: CircuitPlayback = reducedMotion()
      ? 'still'
      : enabled() && this.onScreen && !document.hidden ? 'playing' : 'paused';
    this.grid.setPlayback(next);
    this.playback.set(next);
  }

  refreshPalette(): void {
    this.grid.setPalette(this.options.palette());
  }
}
