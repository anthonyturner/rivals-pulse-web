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
});
