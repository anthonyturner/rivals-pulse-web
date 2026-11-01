import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, DestroyRef, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { CONSENT_NOT_REQUIRED, CONSENT_PENDING, ConsentReading, isRecord, readConsent } from './tcf-consent';

/** The version of the IAB Transparency and Consent Framework API that Google's consent message answers. */
const TCF_VERSION = 2;
const POLL_MS = 100;

/**
 * How long to wait for Google's consent message to appear before deciding that none applies. Google
 * serves it only to visitors in the EEA, the UK and Switzerland, so for everyone else it never
 * appears. Google's own AdSense loader gives it 500ms; this allows more because the cost of waiting
 * is only that the house ad shows a little longer.
 */
export const CONSENT_WAIT_MS = 3000;

/**
 * Google's own consent message (Privacy & messaging in the AdSense account), seen from the app. The
 * message and the AdSense loader are added to every page by `index.html`; this service only reads
 * what the visitor chose and can reopen the message. It stores nothing and builds no banner.
 */
@Injectable({ providedIn: 'root' })
export class GoogleConsentService {
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly reading = signal<ConsentReading>(CONSENT_PENDING);

  readonly status = computed(() => this.reading().status);
  /** True only where Google's message applies, which is where a "change my choice" control makes sense. */
  readonly canChangeChoice = computed(() => this.reading().regulated);

  constructor() {
    if (this.view && isPlatformBrowser(inject(PLATFORM_ID))) {
      this.waitForMessage(this.view, inject(DestroyRef));
    }
  }

  /**
   * Shows Google's consent message again, so the visitor can change what they chose. This is the
   * call Google documents for a revocation link: queue `googlefc.showRevocationMessage`.
   */
  reopenChoices(): void {
    const googlefc: unknown = this.view ? Reflect.get(this.view, 'googlefc') : undefined;
    if (!isRecord(googlefc)) {
      return;
    }

    const { callbackQueue, showRevocationMessage } = googlefc;
    if (isRecord(callbackQueue) && typeof callbackQueue['push'] === 'function' && typeof showRevocationMessage === 'function') {
      Reflect.apply(callbackQueue['push'], callbackQueue, [showRevocationMessage]);
    }
  }

  private waitForMessage(view: Window, destroyRef: DestroyRef): void {
    let waited = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const look = (): void => {
      if (this.listen(view)) {
        return;
      }

      if (waited >= CONSENT_WAIT_MS) {
        this.reading.set(CONSENT_NOT_REQUIRED);
        return;
      }

      waited += POLL_MS;
      timer = setTimeout(look, POLL_MS);
    };

    destroyRef.onDestroy(() => clearTimeout(timer));
    look();
  }

  private listen(view: Window): boolean {
    const api: unknown = Reflect.get(view, '__tcfapi');
    if (typeof api !== 'function') {
      return false;
    }

    try {
      Reflect.apply(api, view, [
        'addEventListener',
        TCF_VERSION,
        (data: unknown, success: boolean) => this.reading.set(readConsent(data, success)),
      ]);
    } catch (error: unknown) {
      console.error("Could not read the visitor's choice from Google's consent message", error);
      this.reading.set({ status: 'declined', regulated: false });
    }

    return true;
  }
}
