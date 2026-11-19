import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

import { PulseCueSink } from './pulse-sound-scheduler';
import { PulseVoices } from './pulse-voices';

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * The browser's audio output for the pulse banner. Browsers refuse to start audio until the visitor
 * has interacted with the page, so nothing is created on the server or on load: `unlock()` runs from
 * a click or key press, and `unlockOnNextGesture()` waits for the first one when the visitor's saved
 * choice is "on" and they have not touched the page yet.
 */
@Injectable({ providedIn: 'root' })
export class PulseAudioService {
  private readonly document = inject(DOCUMENT);
  private context: AudioContext | null = null;
  private waitingForGesture = false;
  private readonly running = signal(false);

  /** Whether sound can play now. */
  readonly ready = this.running.asReadonly();

  /** Starts, or resumes, the audio output. Call it from inside the visitor's own gesture. */
  unlock(): void {
    const view = this.document.defaultView;
    if (!view?.AudioContext) return;
    if (!this.context) {
      this.context = new view.AudioContext();
      this.context.addEventListener('statechange', () => this.syncState());
    }
    void this.context.resume().then(() => this.syncState(), () => this.syncState());
    this.syncState();
  }

  unlockOnNextGesture(): void {
    if (this.waitingForGesture || this.running()) return;
    this.waitingForGesture = true;
    const unlock = (): void => {
      for (const gesture of GESTURES) this.document.removeEventListener(gesture, unlock, true);
      this.waitingForGesture = false;
      this.unlock();
    };
    for (const gesture of GESTURES) this.document.addEventListener(gesture, unlock, { capture: true, passive: true });
  }

  /** A new listening session, or null while audio is not allowed to play. */
  open(): PulseCueSink | null {
    return this.context && this.running() ? new PulseVoices(this.context) : null;
  }

  private syncState(): void {
    this.running.set(this.context?.state === 'running');
  }
}
