import { PulseCue } from './pulse-cues';

/** Soft overall: the heartbeat is meant to sit under a page, not over it. */
const MASTER_LEVEL = 0.6;
const NOISE_SECONDS = 0.12;

/** The pan each side gets; short of the extremes so neither ear is left alone. */
const PAN: Record<PulseCue['side'], number> = { left: -0.7, right: 0.7, centre: 0 };

/**
 * Makes the banner's sounds from oscillators and noise, so there is nothing to download. One
 * `PulseVoices` is one listening session: its master gain is what a pause cuts, and `close()`
 * drops the voices that were scheduled but have not sounded yet.
 */
export class PulseVoices {
  private readonly master: GainNode;
  private noise: AudioBuffer | null = null;

  constructor(private readonly context: BaseAudioContext) {
    this.master = context.createGain();
    this.master.gain.value = MASTER_LEVEL;
    this.master.connect(context.destination);
  }

  now(): number {
    return this.context.currentTime;
  }

  play(cue: PulseCue, at: number): void {
    const out = this.context.createStereoPanner();
    out.pan.value = PAN[cue.side];
    out.connect(this.master);
    switch (cue.kind) {
      case 'lub':
        return this.thump(out, at, { hz: cue.side === 'left' ? 58 : 66, peak: 0.55, decay: 0.16 });
      case 'dub':
        return this.thump(out, at, { hz: cue.side === 'left' ? 74 : 84, peak: 0.38, decay: 0.12 });
      case 'crack':
        return this.crack(out, at);
      case 'boom':
        return this.boom(out, at);
    }
  }

  close(): void {
    this.master.disconnect();
  }

  /** A low, rounded thump: a sine that sags in pitch as it dies away. */
  private thump(out: AudioNode, at: number, { hz, peak, decay }: { hz: number; peak: number; decay: number }): void {
    const osc = this.context.createOscillator();
    osc.frequency.setValueAtTime(hz * 1.6, at);
    osc.frequency.exponentialRampToValueAtTime(hz, at + 0.04);
    this.envelope(osc, out, at, peak, decay);
  }

  /** A short electric snap: a burst of high-passed noise over a fast downward zap. */
  private crack(out: AudioNode, at: number): void {
    const hiss = this.context.createBufferSource();
    hiss.buffer = this.noiseBuffer();
    const highpass = this.context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 2400;
    hiss.connect(highpass);
    const level = this.context.createGain();
    level.gain.setValueAtTime(0.0001, at);
    level.gain.exponentialRampToValueAtTime(0.5, at + 0.004);
    level.gain.exponentialRampToValueAtTime(0.0001, at + NOISE_SECONDS);
    highpass.connect(level).connect(out);
    hiss.start(at);

    const zap = this.context.createOscillator();
    zap.type = 'sawtooth';
    zap.frequency.setValueAtTime(3200, at);
    zap.frequency.exponentialRampToValueAtTime(380, at + 0.09);
    this.envelope(zap, out, at, 0.18, 0.09);
  }

  /** A deep boom: a sine falling a couple of octaves, held longer than the thumps. */
  private boom(out: AudioNode, at: number): void {
    const osc = this.context.createOscillator();
    osc.frequency.setValueAtTime(110, at);
    osc.frequency.exponentialRampToValueAtTime(34, at + 0.5);
    this.envelope(osc, out, at, 1, 0.7);
  }

  /** Plays `source` through a swell of a few milliseconds and a fall of `decay` seconds, ending it afterwards. */
  private envelope(source: OscillatorNode, out: AudioNode, at: number, peak: number, decay: number): void {
    const level = this.context.createGain();
    level.gain.setValueAtTime(0.0001, at);
    level.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    level.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    source.connect(level).connect(out);
    source.start(at);
    source.stop(at + decay + 0.02);
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise;
    const { sampleRate } = this.context;
    const buffer = this.context.createBuffer(1, Math.ceil(sampleRate * NOISE_SECONDS), sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.noise = buffer;
    return buffer;
  }
}
