import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

import type { DeleteAccountRequest } from './account-deletion.types';
import type { LinkedPlayer } from './linked-player.types';
import { parseOwnDashboard } from './own-dashboard.parse';
import type { OwnDashboardResponse } from './own-dashboard.types';

/** What the account page shows. It matches what `GET /api/auth/session` returns. */
export interface Account {
  email: string | null;
  provider: string;
  createdAt: string;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; account: Account; player: LinkedPlayer | null }
  /** The session could not be read; the visitor is treated as signed out. */
  | { status: 'unavailable' };

export type DeleteAccountResult =
  | { status: 'deleted' }
  /** There was no valid session to delete, so nothing was deleted. */
  | { status: 'signedOut' }
  /** The session is fine but the last sign-in is too old; nothing was deleted. */
  | { status: 'signInAgain' }
  | { status: 'failed'; message: string };

export type LinkChangeResult =
  | { status: 'done' }
  /** There was no valid session, so nothing changed. */
  | { status: 'signedOut' }
  /** The server's own words for why it refused (a wrong code, too many tries), or a generic line. */
  | { status: 'failed'; message: string };

export type DashboardResult =
  | { status: 'ready'; dashboard: OwnDashboardResponse }
  /** There was no valid session, so there is nothing to show. */
  | { status: 'signedOut' }
  /** The stats could not be read right now; the visitor is still signed in. */
  | { status: 'unavailable' };

const LINK_FAILED = 'The desktop app could not be linked right now. Try again in a moment.';
const UNLINK_FAILED = 'The desktop app could not be unlinked right now. Try again in a moment.';
const DELETE_FAILED = 'The deletion did not go through, as far as we can tell. Try again in a moment.';

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
        if ((await this.reasonOf(response)) === 'recent-sign-in-required') {
          return { status: 'signInAgain' };
        }

        this.markSignedOut();

        return { status: 'signedOut' };
      }

      return { status: 'failed', message: await this.errorMessage(response) };
    } catch {
      return { status: 'failed', message: DELETE_FAILED };
    }
  }

  /** Links the signed-in account to the player the desktop app showed a code for. */
  async linkPlayer(code: string): Promise<LinkChangeResult> {
    return this.changeLink('/api/account/link', { code }, LINK_FAILED);
  }

  /** Removes the link between the signed-in account and its player. */
  async unlinkPlayer(): Promise<LinkChangeResult> {
    return this.changeLink('/api/account/unlink', {}, UNLINK_FAILED);
  }

  /** Reads the signed-in player's own stats, worked out on the server from the matches their link proves are theirs. */
  async loadDashboard(): Promise<DashboardResult> {
    try {
      const response = await fetch('/api/account/dashboard');

      if (response.status === 401) {
        this.markSignedOut();

        return { status: 'signedOut' };
      }

      const dashboard = response.ok ? parseOwnDashboard(await response.json()) : null;

      return dashboard ? { status: 'ready', dashboard } : { status: 'unavailable' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  private async changeLink(path: string, body: object, fallback: string): Promise<LinkChangeResult> {
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const answer = (await response.json()) as { player?: unknown };

        this.showPlayer(playerOf(answer.player));

        return { status: 'done' };
      }

      if (response.status === 401) {
        this.markSignedOut();

        return { status: 'signedOut' };
      }

      return { status: 'failed', message: await this.errorMessage(response, fallback) };
    } catch {
      return { status: 'failed', message: fallback };
    }
  }

  private showPlayer(player: LinkedPlayer | null): void {
    const current = this.state();

    if (current.status !== 'signedIn') {
      return;
    }

    const next: SessionState = { ...current, player };

    this.state.set(next);
    this.pending = Promise.resolve(next);
  }

  private markSignedOut(): void {
    const signedOut: SessionState = { status: 'signedOut' };

    this.state.set(signedOut);
    this.pending = Promise.resolve(signedOut);
  }

  private async reasonOf(response: Response): Promise<unknown> {
    try {
      return ((await response.json()) as { reason?: unknown } | null)?.reason;
    } catch {
      return undefined;
    }
  }

  /** The server writes its own refusals in plain words; anything else gets the generic line. */
  private async errorMessage(response: Response, fallback: string = DELETE_FAILED): Promise<string> {
    try {
      const body = (await response.json()) as { error?: unknown };

      return typeof body.error === 'string' && body.error ? body.error : fallback;
    } catch {
      return fallback;
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

      const body = (await response.json()) as { signedIn?: boolean; account?: Account; player?: unknown };

      return body.signedIn && body.account
        ? { status: 'signedIn', account: body.account, player: playerOf(body.player) }
        : { status: 'signedOut' };
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function playerOf(value: unknown): LinkedPlayer | null {
  const player = value as { name?: unknown; avatarUrl?: unknown } | null | undefined;

  return typeof player?.name === 'string' && player.name
    ? { name: player.name, avatarUrl: typeof player.avatarUrl === 'string' ? player.avatarUrl : null }
    : null;
}
