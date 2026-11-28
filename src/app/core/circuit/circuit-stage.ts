import { DestroyRef } from '@angular/core';

import { CircuitGrid, CircuitLook, CircuitPalette, LIVELY_LOOK } from './circuit-grid';
import { PlaybackStage, PlaybackStageOptions } from './playback-stage';

export interface CircuitStageOptions extends PlaybackStageOptions {
  readonly canvas: HTMLCanvasElement;
  readonly look?: CircuitLook;
  /** Read again by `refreshPalette`, since canvas cannot follow CSS variables. */
  readonly palette: () => CircuitPalette;
}

/** A `CircuitGrid` with the shared playback wiring of `PlaybackStage`. */
export class CircuitStage {
  readonly grid: CircuitGrid;
  private readonly stage: PlaybackStage;

  constructor(private readonly options: CircuitStageOptions, destroyRef: DestroyRef) {
    this.grid = new CircuitGrid(options.canvas, options.palette(), Math.random, options.look ?? LIVELY_LOOK);
    this.stage = new PlaybackStage(this.grid, options, destroyRef);
  }

  get playback(): PlaybackStage['playback'] {
    return this.stage.playback;
  }

  refreshPlayback(): void {
    this.stage.refreshPlayback();
  }

  refreshPalette(): void {
    this.grid.setPalette(this.options.palette());
  }
}
