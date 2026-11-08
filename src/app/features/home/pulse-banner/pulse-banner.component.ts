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

import { ThemeService } from '../../../core/theme/theme.service';
import { CircuitGrid, CircuitPalette, CircuitPlayback } from './circuit-grid';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

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

  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly theme = inject(ThemeService).theme;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('grid');
  private readonly grid = signal<CircuitGrid | null>(null);

  private onScreen = false;

  protected readonly playback = signal<CircuitPlayback>('still');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const view = this.document.defaultView;
      if (!view) return;
      const grid = new CircuitGrid(this.canvas().nativeElement, this.readPalette());
      this.watchSize(grid, view, destroyRef);
      this.watchPlayback(grid, view, destroyRef);
      destroyRef.onDestroy(() => grid.destroy());
      this.grid.set(grid);
    });

    // Canvas cannot follow CSS variables, so a theme change re-reads the palette.
    effect(() => {
      this.theme();
      const grid = this.grid();
      if (grid) untracked(() => grid.setPalette(this.readPalette()));
    });
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

  private watchPlayback(grid: CircuitGrid, view: Window, destroyRef: DestroyRef): void {
    const reducedMotion = view.matchMedia(REDUCED_MOTION_QUERY);
    const update = (): void => {
      const next: CircuitPlayback = reducedMotion.matches
        ? 'still'
        : this.onScreen && !this.document.hidden ? 'playing' : 'paused';
      grid.setPlayback(next);
      this.playback.set(next);
    };

    const observer = new IntersectionObserver(([entry]) => {
      this.onScreen = entry.isIntersecting;
      update();
    });
    observer.observe(this.host.nativeElement);

    this.document.addEventListener('visibilitychange', update);
    reducedMotion.addEventListener('change', update);
    destroyRef.onDestroy(() => {
      observer.disconnect();
      this.document.removeEventListener('visibilitychange', update);
      reducedMotion.removeEventListener('change', update);
    });
    update();
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
