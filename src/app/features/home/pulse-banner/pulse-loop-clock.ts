import { LoopReading } from '../../../core/circuit/loop-cues';

/** The most the animation's last frame can be behind the real clock before the reading is not trusted to catch up. */
const MAX_FRAME_LAG_MS = 100;

/**
 * Reads where the banner's own CSS animation stands, so sound and shockwave follow the picture
 * itself instead of a second clock that could drift from it. `element` carries an animation
 * that runs for the whole loop. Holding the animation (paused tab, off screen) holds the reading.
 */
export class PulseLoopClock {
  private animation: Animation | null = null;

  constructor(private readonly element: () => Element | null) {}

  read(): LoopReading | null {
    const animation = this.find();
    const duration = animation?.effect?.getComputedTiming().duration;
    const position = animation?.currentTime;
    if (typeof duration !== 'number' || !(duration > 0) || typeof position !== 'number') return null;
    return { loopMs: duration, positionMs: position + this.frameLag() };
  }

  /** The animation's time is that of the last frame; the audio is scheduled against now, so the gap is added. */
  private frameLag(): number {
    const frameAt = document.timeline.currentTime;
    if (typeof frameAt !== 'number') return 0;
    return Math.min(MAX_FRAME_LAG_MS, Math.max(0, performance.now() - frameAt));
  }

  private find(): Animation | null {
    if (this.animation && this.animation.playState !== 'idle') return this.animation;
    this.animation = this.element()?.getAnimations()[0] ?? null;
    return this.animation;
  }
}
