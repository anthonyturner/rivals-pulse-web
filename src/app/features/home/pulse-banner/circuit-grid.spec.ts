import { CircuitGrid, CircuitPalette } from './circuit-grid';

describe('CircuitGrid', () => {
  const palette: CircuitPalette = { line: '#445566', currents: ['#aa8800', '#5555ee', '#aa44cc'] };

  let canvas: HTMLCanvasElement;
  let grid: CircuitGrid;
  let frames: FrameRequestCallback[];
  let cancelled: number[];
  let clock: number;

  /** Plays frames, 16 ms apart, until `ms` have passed. */
  function runFor(ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      clock += 16;
      frames.pop()?.(clock);
    }
  }

  function painted(): boolean {
    const { data } = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height) ?? { data: [] };
    return Array.from(data).some((value, index) => index % 4 === 3 && value > 0);
  }

  beforeEach(() => {
    frames = [];
    cancelled = [];
    clock = 0;
    spyOn(window, 'requestAnimationFrame').and.callFake(callback => frames.push(callback));
    spyOn(window, 'cancelAnimationFrame').and.callFake(handle => {
      cancelled.push(handle);
      frames = [];
    });
    canvas = document.createElement('canvas');
    grid = new CircuitGrid(canvas, palette, () => 0.5);
    grid.resize(480, 128, 1);
  });

  afterEach(() => grid.destroy());

  it('draws the circuit grid before it plays', () => {
    expect(painted()).toBeTrue();
  });

  describe('playing', () => {
    beforeEach(() => grid.setPlayback('playing'));

    it('keeps asking for the next animation frame', () => {
      runFor(160);

      expect(frames.length).toBe(1);
    });

    it('sends no stronger pulse before the wait is over', () => {
      runFor(8_000);

      expect(grid.strongPulses).toBe(0);
    });

    it('sends one stronger pulse across the grid when the wait is over', () => {
      runFor(9_200);

      expect(grid.strongPulses).toBe(1);
    });

    it('lets the stronger pulse run out the far side and go', () => {
      runFor(9_200);

      runFor(2_000);

      expect(grid.strongPulses).toBe(0);
    });

    it('sends another one after the next wait', () => {
      runFor(9_200);
      runFor(2_000);

      runFor(6_000);

      expect(grid.strongPulses).toBe(0);
      runFor(2_000);
      expect(grid.strongPulses).toBe(1);
    });

    it('stops asking for frames once paused', () => {
      runFor(48);
      grid.setPlayback('paused');

      expect(cancelled.length).toBeGreaterThan(0);
      expect(frames.length).toBe(0);
    });
  });

  describe('on a bigger grid', () => {
    /** Ordinary pulses the grid holds after `seconds` of play. */
    function ambientAfter(width: number, height: number, seconds: number, random: () => number = () => 0.5): number {
      grid.destroy();
      grid = new CircuitGrid(canvas, palette, random);
      grid.resize(width, height, 1);
      grid.setPlayback('playing');
      runFor(seconds * 1000);
      return grid.ambientPulses;
    }

    function capacityAt(width: number, height: number): number {
      grid.resize(width, height, 1);
      return grid.ambientCapacity;
    }

    it("holds the strip's 14 ordinary pulses at the strip's size, and no fewer on a smaller strip", () => {
      expect(capacityAt(1320, 128)).toBe(14);
      expect(capacityAt(343, 104)).toBe(14);
    });

    it('holds more in proportion to the area, up to a cap that keeps a frame cheap', () => {
      expect(capacityAt(1425, 826)).toBeGreaterThan(14);
      expect(capacityAt(343, 974)).toBeGreaterThan(14);
      expect(capacityAt(4000, 3000)).toBe(32);
    });

    it('fills a bigger grid as fast as the strip fills, by starting pulses more often', () => {
      expect(ambientAfter(1425, 826, 5)).toBeGreaterThan(ambientAfter(1320, 128, 5));
    });

    it('starts pulses across the whole grid, not only at the centre', () => {
      const seen: [number, number][] = [];
      let n = 0;
      const random = (): number => (n = (n + 0.137) % 1);
      grid.destroy();
      grid = new CircuitGrid(canvas, palette, random);
      grid.resize(1425, 826, 1);
      grid.setPlayback('playing');
      for (let i = 0; i < 40; i++) {
        runFor(400);
        for (const pulse of (grid as unknown as { pulses: { x: number; y: number; strong: boolean }[] }).pulses) {
          if (!pulse.strong && pulse.x < 300) seen.push([pulse.x, pulse.y]);
        }
      }

      expect(seen.length).withContext('pulses seen in the left fifth').toBeGreaterThan(0);
    });

    it('starts every pulse of the strip at its centre, as it always has', () => {
      grid.destroy();
      grid = new CircuitGrid(canvas, palette, () => 0.5);
      grid.resize(1320, 128, 1);
      grid.setPlayback('playing');
      runFor(16);

      const [first] = (grid as unknown as { pulses: { x: number; y: number }[] }).pulses;
      expect([first.x, first.y]).toEqual([Math.round(1320 / 2 / 24) * 24, Math.round(128 / 2 / 24) * 24]);
    });

    it('draws a still frame with more currents on a bigger grid', () => {
      grid.destroy();
      grid = new CircuitGrid(canvas, palette, () => 0.5);
      grid.resize(1425, 826, 1);
      grid.setPlayback('still');

      expect(grid.ambientPulses).toBeGreaterThan(6);
    });
  });

  describe('paused', () => {
    it('does not count down to a surge, so it is not owed one when it plays again', () => {
      grid.setPlayback('playing');
      runFor(8_000);
      grid.setPlayback('paused');
      clock += 5_000;

      grid.setPlayback('playing');
      runFor(800);

      expect(grid.strongPulses).toBe(0);
    });

    it('asks for no animation frame', () => {
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('still (reduced motion)', () => {
    beforeEach(() => grid.setPlayback('still'));

    it('shows one frame of grid and currents and asks for no animation frame', () => {
      expect(painted()).toBeTrue();
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });

    it('draws the frame again at a new size, still without animating', () => {
      grid.resize(640, 104, 2);

      expect(canvas.width).toBe(1280);
      expect(painted()).toBeTrue();
      expect(window.requestAnimationFrame).not.toHaveBeenCalled();
    });
  });

  describe('the pointer', () => {
    function alphaAt(x: number, y: number): number {
      return canvas.getContext('2d')?.getImageData(x, y, 1, 1).data[3] ?? 0;
    }

    function firstPulse(): { dx: number; dy: number } {
      return (grid as unknown as { pulses: { dx: number; dy: number }[] }).pulses[0];
    }

    it('lights the grid lines around it while the grid plays, and no others', () => {
      grid.setPlayback('playing');
      grid.setPointer({ x: 48, y: 40 });
      runFor(16);

      expect(alphaAt(48, 30)).withContext('a line beside the pointer').toBeGreaterThan(alphaAt(432, 30) + 30);
    });

    it('turns a pulse that comes within its reach toward it', () => {
      grid.setPlayback('playing');
      grid.setPointer({ x: 264, y: 110 });
      runFor(160);

      expect([firstPulse().dx, firstPulse().dy]).toEqual([0, 1]);
    });

    it('leaves a pulse going straight without it', () => {
      grid.setPlayback('playing');
      runFor(160);

      expect([firstPulse().dx, firstPulse().dy]).toEqual([1, 0]);
    });

    it('leaves a pulse out of its reach alone', () => {
      grid.setPlayback('playing');
      grid.setPointer({ x: 264, y: 128 + 400 });
      runFor(160);

      expect([firstPulse().dx, firstPulse().dy]).toEqual([1, 0]);
    });

    it('is ignored while the grid is paused or still', () => {
      for (const playback of ['paused', 'still'] as const) {
        grid.setPlayback(playback);
        grid.setPointer({ x: 48, y: 40 });
        grid.resize(480, 128, 1);

        expect(alphaAt(48, 30)).withContext(playback).toBe(alphaAt(432, 30));
      }
    });

    it('goes when the grid pauses, and is not back when it plays again', () => {
      grid.setPlayback('playing');
      grid.setPointer({ x: 48, y: 40 });
      grid.setPlayback('paused');
      grid.setPlayback('playing');
      runFor(16);

      expect(alphaAt(48, 30)).toBe(alphaAt(432, 30));
    });
  });

  describe('the shockwave', () => {
    const loopMs = 2800;
    let positionMs: number;

    beforeEach(() => {
      positionMs = 1000;
      grid.setClash({ clock: { read: () => ({ loopMs, positionMs }) }, origin: () => [240, 72] });
    });

    it('leaves the collision when the loop passes it', () => {
      grid.setPlayback('playing');
      runFor(16);
      expect(grid.activeShockwaves).toBe(0);

      positionMs = 1600;
      runFor(16);

      expect(grid.activeShockwaves).toBe(1);
    });

    it('waits for the collision: none before the loop reaches it', () => {
      grid.setPlayback('playing');
      runFor(16);

      positionMs = 1500;
      runFor(16);

      expect(grid.activeShockwaves).toBe(0);
    });

    it('comes again on every loop', () => {
      grid.setPlayback('playing');
      runFor(16);

      positionMs = 1600;
      runFor(16);
      positionMs = 2800 + 1000;
      runFor(1_300);
      expect(grid.activeShockwaves).toBe(0);
      positionMs = 2800 + 1600;
      runFor(16);

      expect(grid.activeShockwaves).toBe(1);
    });

    it('runs out after about a second', () => {
      grid.setPlayback('playing');
      runFor(16);
      positionMs = 1600;
      runFor(16);

      runFor(1_200);

      expect(grid.activeShockwaves).toBe(0);
    });

    it('is not sent while the grid is paused, and is gone in reduced motion', () => {
      grid.setPlayback('paused');
      positionMs = 1600;
      runFor(160);
      expect(grid.activeShockwaves).toBe(0);

      grid.setPlayback('playing');
      runFor(16);
      positionMs = 2800 + 1600;
      runFor(16);
      expect(grid.activeShockwaves).toBe(1);

      grid.setPlayback('still');
      expect(grid.activeShockwaves).toBe(0);
    });
  });
});
