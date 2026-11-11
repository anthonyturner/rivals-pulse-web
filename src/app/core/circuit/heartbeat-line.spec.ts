import {
  HeartbeatLine,
  MAX_BEATS_PER_MINUTE,
  MIN_BEATS_PER_MINUTE,
  RESTING_BEATS_PER_MINUTE,
  ecgDeflection,
  heartbeatRate,
} from './heartbeat-line';

describe('heartbeatRate', () => {
  it('rests in the middle of the calm range when no volume is known', () => {
    expect(heartbeatRate(null)).toBe(RESTING_BEATS_PER_MINUTE);
    expect(heartbeatRate(Number.NaN)).toBe(RESTING_BEATS_PER_MINUTE);
  });

  it('beats slowest on a quiet day and never stops', () => {
    expect(heartbeatRate(0)).toBe(MIN_BEATS_PER_MINUTE);
    expect(heartbeatRate(-5)).toBe(MIN_BEATS_PER_MINUTE);
  });

  it('beats faster as more matches are uploaded, and never faster than the calm limit', () => {
    expect(heartbeatRate(10)).toBeLessThan(heartbeatRate(100));
    expect(heartbeatRate(100)).toBeLessThan(heartbeatRate(500));
    expect(heartbeatRate(1_000_000)).toBe(MAX_BEATS_PER_MINUTE);
  });
});

describe('ecgDeflection', () => {
  it('is flat between beats and spikes at the QRS complex', () => {
    expect(ecgDeflection(0)).toBe(0);
    expect(ecgDeflection(0.05)).toBe(0);
    expect(ecgDeflection(0.315)).toBeCloseTo(1, 10);
    expect(ecgDeflection(0.8)).toBe(0);
  });

  it('dips below the baseline just before and after the spike', () => {
    expect(ecgDeflection(0.29)).toBeLessThan(0);
    expect(ecgDeflection(0.34)).toBeLessThan(0);
  });

  it('repeats every beat, and stays within the drawn range', () => {
    expect(ecgDeflection(3.315)).toBeCloseTo(ecgDeflection(0.315), 10);
    expect(ecgDeflection(-0.685)).toBeCloseTo(ecgDeflection(0.315), 10);

    for (let phase = 0; phase < 1; phase += 0.01) {
      expect(Math.abs(ecgDeflection(phase))).toBeLessThanOrEqual(1);
    }
  });
});

describe('HeartbeatLine', () => {
  let canvas: HTMLCanvasElement;
  let line: HeartbeatLine;
  let frames: FrameRequestCallback[];
  let clock: number;

  function painted(): boolean {
    const { data } = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height) ?? { data: [] };

    return Array.from(data).some((value, index) => index % 4 === 3 && value > 0);
  }

  function runFor(ms: number): void {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      clock += 16;
      frames.pop()?.(clock);
    }
  }

  beforeEach(() => {
    frames = [];
    clock = 0;
    spyOn(window, 'requestAnimationFrame').and.callFake((callback) => frames.push(callback));
    spyOn(window, 'cancelAnimationFrame').and.callFake(() => {
      frames = [];
    });
    canvas = document.createElement('canvas');
    line = new HeartbeatLine(canvas, { line: '#ffdf00' });
    line.resize(480, 96, 1);
  });

  afterEach(() => line.destroy());

  it('draws a trace before it plays, so a held frame is never blank', () => {
    expect(painted()).toBeTrue();
  });

  it('asks for the next animation frame only while it plays', () => {
    line.setPlayback('playing');
    runFor(160);

    expect(frames.length).toBe(1);

    line.setPlayback('paused');

    expect(frames.length).toBe(0);
  });

  it('holds one still frame, with no animation, when asked', () => {
    line.setPlayback('still');

    expect(painted()).toBeTrue();
    expect(frames.length).toBe(0);
  });

  it('keeps its picture while paused and is not drawn on until it plays again', () => {
    line.setPlayback('playing');
    runFor(320);
    line.setPlayback('paused');
    runFor(320);

    expect(frames.length).toBe(0);
    expect(painted()).toBeTrue();
  });
});
