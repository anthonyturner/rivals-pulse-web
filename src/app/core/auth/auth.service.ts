import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import type { DeleteAccountRequest } from './account-deletion.types';

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

export type DeleteAccountResult =
  | { status: 'deleted' }
  /** There was no valid session to delete, so nothing was deleted. */
  | { status: 'signedOut' }
  | { status: 'failed'; message: string };

const DELETE_FAILED = 'The account could not be deleted. Nothing was removed; try again in a moment.';

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

    this.markSignedOut();
  }

  /** Deletes the signed-in account on the server, which also ends the session. */
  async deleteAccount(request: DeleteAccountRequest): Promise<DeleteAccountResult> {
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (response.ok) {
        this.markSignedOut();

        return { status: 'deleted' };
      }

      if (response.status === 401) {
        this.markSignedOut();

        return { status: 'signedOut' };
      }

      return { status: 'failed', message: await this.errorMessage(response) };
    } catch {
      return { status: 'failed', message: DELETE_FAILED };
    }
  }

  private markSignedOut(): void {
    const signedOut: SessionState = { status: 'signedOut' };

    this.state.set(signedOut);
    this.pending = Promise.resolve(signedOut);
  }

  /** The server writes its own refusals in plain words; anything else gets the generic line. */
  private async errorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { error?: unknown };

      return typeof body.error === 'string' && body.error ? body.error : DELETE_FAILED;
    } catch {
      return DELETE_FAILED;
    }
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
