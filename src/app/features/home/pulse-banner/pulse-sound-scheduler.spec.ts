import { COLLISION_CUE, LoopReading, PULSE_CUES, PulseCue } from './pulse-cues';
import { PulseCueSink, PulseSoundScheduler } from './pulse-sound-scheduler';

describe('PulseSoundScheduler', () => {
  const loopMs = 2800;
  const audioOrigin = 10;

  class FakeSink implements PulseCueSink {
    audioNow = audioOrigin;
    played: { cue: PulseCue; at: number }[] = [];
    closed = false;

    now(): number {
      return this.audioNow;
    }

    play(cue: PulseCue, at: number): void {
      this.played.push({ cue, at });
    }

    close(): void {
      this.closed = true;
    }
  }

  let sink: FakeSink;
  let reading: LoopReading | null;
  let scheduler: PulseSoundScheduler;

  /** The animation and the audio clock run together: both are `ms` into the same moment. */
  function at(ms: number): void {
    reading = { loopMs, positionMs: ms };
    sink.audioNow = audioOrigin + ms / 1000;
  }

  const kinds = (): string[] => sink.played.map(item => item.cue.kind);

  beforeEach(() => {
    sink = new FakeSink();
    reading = null;
    scheduler = new PulseSoundScheduler({ read: () => reading }, sink);
  });

  afterEach(() => scheduler.stop());

  it('sounds a cue that is about to come, at its time on the audio clock', () => {
    at(1500);
    scheduler.tick();

    const crack = sink.played.find(item => item.cue.kind === 'crack');
    expect(crack?.at).toBeCloseTo(audioOrigin + (COLLISION_CUE.at * loopMs) / 1000, 6);
  });

  it('sounds nothing that is not due within a moment', () => {
    at(0);
    scheduler.tick();

    expect(sink.played).toEqual([]);
  });

  it('sounds nothing without a reading of the animation', () => {
    reading = null;
    scheduler.tick();

    expect(sink.played).toEqual([]);
  });

  it('sounds each cue once, however often it ticks', () => {
    for (let ms = 1000; ms <= 1800; ms += 50) {
      at(ms);
      scheduler.tick();
    }

    expect(kinds().filter(kind => kind === 'crack').length).toBe(1);
    expect(kinds().filter(kind => kind === 'boom').length).toBe(1);
  });

  it('skips a cue it was too late for instead of sounding it out of step', () => {
    at(0);
    scheduler.tick();
    at(1700);
    scheduler.tick();

    expect(kinds()).not.toContain('crack');
  });

  it('keeps sound on the picture for many loops, with no drift', () => {
    const loops = 20;
    for (let ms = 0; ms < loops * loopMs; ms += 50) {
      at(ms);
      scheduler.tick();
    }

    expect(sink.played.length).toBeGreaterThanOrEqual((loops - 1) * PULSE_CUES.length);
    for (const { cue, at: when } of sink.played) {
      const intoLoop = ((when - audioOrigin) * 1000) % loopMs;
      const gap = Math.abs(intoLoop - cue.at * loopMs);
      expect(Math.min(gap, loopMs - gap)).withContext(cue.kind).toBeLessThan(0.001);
    }
  });

  it('follows the loop wherever it has got to, when it starts partway through', () => {
    at(5 * loopMs + 1500);
    scheduler.tick();

    const crack = sink.played.find(item => item.cue.kind === 'crack');
    expect(crack?.at).toBeCloseTo(audioOrigin + (5 * loopMs + COLLISION_CUE.at * loopMs) / 1000, 6);
  });

  it('sounds the cues that come after the loop starts over', () => {
    at(loopMs - 50);
    scheduler.tick();
    at(loopMs + 100);
    scheduler.tick();

    expect(sink.played.every(item => item.at >= audioOrigin + (loopMs - 50) / 1000)).toBeTrue();
  });

  describe('starting and stopping', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    it('ticks on a timer once started, and not after it stops', () => {
      const tick = spyOn(scheduler, 'tick');
      scheduler.start();
      expect(tick).toHaveBeenCalledTimes(1);

      jasmine.clock().tick(200);
      expect(tick.calls.count()).toBeGreaterThan(3);

      scheduler.stop();
      tick.calls.reset();
      jasmine.clock().tick(1000);
      expect(tick).not.toHaveBeenCalled();
    });

    it('is not started twice by a second start', () => {
      const tick = spyOn(scheduler, 'tick');
      scheduler.start();
      scheduler.start();

      expect(tick).toHaveBeenCalledTimes(1);
    });

    it('silences what was scheduled when it stops', () => {
      scheduler.start();
      scheduler.stop();

      expect(sink.closed).toBeTrue();
    });
  });
});
