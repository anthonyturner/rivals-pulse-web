import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { ReducedMotionService } from '../../accessibility/reduced-motion.service';
import { CALM_LOOK, CircuitPalette } from '../../circuit/circuit-grid';
import { CircuitStage } from '../../circuit/circuit-stage';
import { ThemeService } from '../../theme/theme.service';
import { HOME_NAV_ITEM, activeNav } from '../nav/primary-nav';

/**
 * A calm circuit pulse behind the top navigation bar, on every page but the home page, which has its
 * own banner. The layout owns the one instance, so moving between pages neither restarts nor
 * rebuilds it; on the home page it is hidden and holds still. It is decoration: hidden from assistive
 * technology, no pointer events, and it fills the bar without taking any layout space.
 *
 * The canvas is dimmed as a whole by `--nav-pulse-opacity`, so however many pulses cross at one
 * point no pixel is brighter than that share of a pulse colour over the bar; `npm run test:theme`
 * measures the nav's text against that worst case.
 */
@Component({
  selector: 'app-nav-pulse',
  template: '<canvas #grid></canvas>',
  styleUrl: './nav-pulse.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[hidden]': 'onHome()' },
})
export class NavPulse {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly theme = inject(ThemeService).theme;
  private readonly reducedMotion = inject(ReducedMotionService).reduced;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('grid');
  private readonly stage = signal<CircuitStage | null>(null);

  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly onHome = computed(() => activeNav(this.url())?.path === HOME_NAV_ITEM.path);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      this.stage.set(
        new CircuitStage(
          {
            host: this.host,
            canvas: this.canvas().nativeElement,
            document: this.document,
            look: CALM_LOOK,
            palette: () => this.readPalette(),
            reducedMotion: this.reducedMotion,
            enabled: () => !this.onHome(),
          },
          destroyRef,
        ),
      );
    });

    // Canvas cannot follow CSS variables, so a theme change re-reads the palette.
    effect(() => {
      this.theme();
      const stage = this.stage();
      if (stage) untracked(() => stage.refreshPalette());
    });

    effect(() => {
      this.reducedMotion();
      this.onHome();
      const stage = this.stage();
      if (stage) untracked(() => stage.refreshPlayback());
    });
  }

  /** The bar follows the theme, so the grid takes the theme's own accent colours and its faint-graphic grey. */
  private readPalette(): CircuitPalette {
    const style = getComputedStyle(this.host);
    const read = (name: string): string => style.getPropertyValue(name).trim();
    return {
      line: read('--text-faint'),
      currents: [read('--accent'), read('--secondary'), read('--tertiary')],
    };
  }
}
