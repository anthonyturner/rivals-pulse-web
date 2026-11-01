import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

/** What the account page shows. It matches what `GET /api/auth/session` returns. */
export interface Account {
  email: string | null;
  provider: string;
  createdAt: string;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; account: Account }
  /** The session could not be read; the visitor is treated as signed out. */
  | { status: 'unavailable' };

/**
 * The visitor's sign-in state, read from the server. The session itself lives in an HttpOnly cookie
 * that scripts cannot see, so the only way to know is to ask `/api/auth/session`. It is read in the
 * browser only: production pages are rendered there, and a server render has no visitor to ask about.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private pending?: Promise<SessionState>;

  readonly state = signal<SessionState>({ status: 'loading' });

  /** Reads the session once; later calls share that answer. */
  load(): Promise<SessionState> {
    if (!this.isBrowser) {
      return Promise.resolve(this.state());
    }

    this.pending ??= this.read();

    return this.pending;
  }

  /** Ends the session on the server. If that fails the cookie may survive, so the visitor is asked about again. */
  async signOut(): Promise<void> {
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST' });

      if (!response.ok) {
        throw new Error(`Sign-out answered ${response.status}`);
      }
    } catch {
      this.pending = undefined;
      await this.load();

      return;
    }

    const signedOut: SessionState = { status: 'signedOut' };

    this.state.set(signedOut);
    this.pending = Promise.resolve(signedOut);
  }

  private async read(): Promise<SessionState> {
    const next = await this.fetchSession();

    this.state.set(next);

    return next;
  }

  private async fetchSession(): Promise<SessionState> {
    try {
      const response = await fetch('/api/auth/session');

      if (!response.ok) {
        return { status: 'unavailable' };
      }

      const body = (await response.json()) as { signedIn?: boolean; account?: Account };

      return body.signedIn && body.account
        ? { status: 'signedIn', account: body.account }
        : { status: 'signedOut' };
    } catch {
      return { status: 'unavailable' };
    }
  }
}
