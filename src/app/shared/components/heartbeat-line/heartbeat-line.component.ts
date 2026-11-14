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
import { HeartbeatLine, RESTING_BEATS_PER_MINUTE } from '../../../core/circuit/heartbeat-line';
import { PlaybackStage } from '../../../core/circuit/playback-stage';
import { ThemeService } from '../../../core/theme/theme.service';

/**
 * A faint ECG-style line that fills its positioned parent, for behind a row of headline numbers. The
 * beat rate is the caller's (`rate`, in beats a minute). It is decoration: hidden from assistive
 * technology, no pointer events, no layout space of its own, and nothing is drawn on the server. It
 * plays only while on screen and while the tab is visible, and holds one still frame when the visitor
 * asks for less motion. The canvas is dimmed as a whole by `--heartbeat-opacity`, which is lower in the
 * light theme.
 */
@Component({
  selector: 'app-heartbeat-line',
  template: '<canvas #line></canvas>',
  styleUrl: './heartbeat-line.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class HeartbeatLineComponent {
  /** Beats per minute. */
  readonly rate = input(RESTING_BEATS_PER_MINUTE);

  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly theme = inject(ThemeService).theme;
  private readonly reducedMotion = inject(ReducedMotionService).reduced;
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('line');
  private readonly drawn = signal<{ line: HeartbeatLine; stage: PlaybackStage } | null>(null);

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const line = new HeartbeatLine(this.canvas().nativeElement, this.readPalette(), this.rate());
      const stage = new PlaybackStage(
        line,
        { host: this.host, document: this.document, reducedMotion: this.reducedMotion },
        destroyRef,
      );
      this.drawn.set({ line, stage });
    });

    // Canvas cannot follow CSS variables, so a theme change re-reads the colour.
    effect(() => {
      this.theme();
      const drawn = this.drawn();
      if (drawn) untracked(() => drawn.line.setPalette(this.readPalette()));
    });

    effect(() => {
      const rate = this.rate();
      const drawn = this.drawn();
      if (drawn) untracked(() => drawn.line.setRate(rate));
    });

    effect(() => {
      this.reducedMotion();
      const drawn = this.drawn();
      if (drawn) untracked(() => drawn.stage.refreshPlayback());
    });
  }

  private readPalette(): { line: string } {
    return { line: getComputedStyle(this.host).getPropertyValue('--accent').trim() };
  }
}
