import { DestroyRef, signal } from '@angular/core';

import type { CircuitPlayback } from './circuit-grid';

/** What a stage drives: a canvas drawing the owner can size, play, hold and release. */
export interface StageSurface {
  resize(width: number, height: number, pixelRatio: number): void;
  setPlayback(playback: CircuitPlayback): void;
  destroy(): void;
}

export interface PlaybackStageOptions {
  /** The box the surface fills: it is measured for the canvas's size and watched for being on screen. */
  readonly host: HTMLElement;
  readonly document: Document;
  /** Whether the visitor asked for less motion, which holds one still frame. */
  readonly reducedMotion: () => boolean;
  /** Whether the surface has a place to show; false holds its picture without drawing frames. Always on unless set. */
  readonly enabled?: () => boolean;
}

/**
 * The playback wiring every animated canvas shares: it sizes the surface to its host, plays only while
 * the host is on screen, the tab is visible and the surface is enabled, and holds one still frame in
 * reduced motion. The owner calls `refreshPlayback` when `reducedMotion` or `enabled` change. Create
 * it in the browser only, since it needs the observers.
 */
export class PlaybackStage {
  readonly playback = signal<CircuitPlayback>('still');

  private onScreen = false;

  constructor(
    private readonly surface: StageSurface,
    private readonly options: PlaybackStageOptions,
    destroyRef: DestroyRef,
  ) {
    const { host, document } = options;
    const view = document.defaultView;

    const resize = (): void => {
      const { width, height } = host.getBoundingClientRect();
      surface.resize(width, height, view?.devicePixelRatio || 1);
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
      surface.destroy();
    });
    this.refreshPlayback();
  }

  refreshPlayback(): void {
    const { reducedMotion, enabled = () => true, document } = this.options;
    const next: CircuitPlayback = reducedMotion()
      ? 'still'
      : enabled() && this.onScreen && !document.hidden ? 'playing' : 'paused';
    this.surface.setPlayback(next);
    this.playback.set(next);
  }
}
