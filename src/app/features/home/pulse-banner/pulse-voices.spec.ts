import { PULSE_CUES, PulseCue } from './pulse-cues';
import { PulseVoices } from './pulse-voices';

describe('PulseVoices', () => {
  const sampleRate = 44100;
  const playAt = 0.1;

  /** Renders `seconds` of what `play` schedules, offline, so no speaker or gesture is needed. */
  async function render(play: (voices: PulseVoices) => void, seconds = 1.5): Promise<[Float32Array, Float32Array]> {
    const context = new OfflineAudioContext(2, Math.round(seconds * sampleRate), sampleRate);
    play(new PulseVoices(context));
    const buffer = await context.startRendering();
    return [buffer.getChannelData(0), buffer.getChannelData(1)];
  }

  const peak = (samples: Float32Array, fromSeconds = 0, toSeconds = Infinity): number => {
    let loudest = 0;
    for (let i = Math.floor(fromSeconds * sampleRate); i < Math.min(samples.length, toSeconds * sampleRate); i++) {
      loudest = Math.max(loudest, Math.abs(samples[i]));
    }
    return loudest;
  };

  const cueOf = (kind: PulseCue['kind'], side: PulseCue['side']): PulseCue => PULSE_CUES.find(cue => cue.kind === kind && cue.side === side) as PulseCue;

  it('makes an audible sound for every cue, and none before it is due', async () => {
    for (const cue of PULSE_CUES) {
      const [left, right] = await render(voices => voices.play(cue, playAt));

      expect(Math.max(peak(left, playAt), peak(right, playAt))).withContext(`${cue.side} ${cue.kind}`).toBeGreaterThan(0.01);
      expect(Math.max(peak(left, 0, playAt - 0.005), peak(right, 0, playAt - 0.005))).withContext(`${cue.side} ${cue.kind} early`).toBe(0);
    }
  });

  it('keeps the soft heartbeat softer than the clash, and the clash from clipping', async () => {
    const [lub] = await render(voices => voices.play(cueOf('lub', 'left'), playAt));
    const [boom] = await render(voices => voices.play(cueOf('boom', 'centre'), playAt));
    const [crack] = await render(voices => voices.play(cueOf('crack', 'centre'), playAt));

    expect(peak(lub)).toBeLessThan(peak(boom));
    expect(peak(boom)).toBeLessThan(1);
    expect(peak(crack)).toBeLessThan(1);
  });

  it('pans each pulse to its own side, and the clash to the middle', async () => {
    const [leftOfLeft, rightOfLeft] = await render(voices => voices.play(cueOf('lub', 'left'), playAt));
    const [leftOfRight, rightOfRight] = await render(voices => voices.play(cueOf('lub', 'right'), playAt));
    const [leftOfClash, rightOfClash] = await render(voices => voices.play(cueOf('boom', 'centre'), playAt));

    expect(peak(leftOfLeft)).toBeGreaterThan(peak(rightOfLeft) * 2);
    expect(peak(rightOfRight)).toBeGreaterThan(peak(leftOfRight) * 2);
    expect(peak(leftOfClash)).toBeCloseTo(peak(rightOfClash), 3);
  });

  it('is silenced by close, even for sounds already scheduled', async () => {
    const [left, right] = await render(voices => {
      voices.play(cueOf('boom', 'centre'), playAt);
      voices.close();
    });

    expect(peak(left)).toBe(0);
    expect(peak(right)).toBe(0);
  });
});
