import { computed, effect, inject, signal, untracked, type Signal } from '@angular/core';

import { AuthService, type DashboardResult, type SessionState } from '../../../core/auth/auth.service';
import type { OwnActivity, OwnActivityRow } from '../../../core/auth/own-dashboard.types';
import type { CommunitySummaryLink } from '../community-summary/community-summary.component';

export type OwnActivityState =
  | { kind: 'loading' | 'unavailable' }
  | { kind: 'not-enough-data'; summary: string; link: CommunitySummaryLink }
  | { kind: 'ready'; activity: OwnActivity; truncated: boolean };

export interface OwnActivityRowView {
  label: string;
  matches: number;
  winRate: string;
  /** The win rate, 0 to 100, as the width of its bar. */
  barPercent: number;
}

export interface OwnActivityTableView {
  title: string;
  rowHeading: string;
  rows: OwnActivityRowView[];
}

const ACCOUNT_LINK: CommunitySummaryLink = { label: 'Go to your account', path: '/account' };

/**
 * What a private Community tab shows, keyed on who is signed in. Nothing is kept between accounts:
 * the session is checked before any figure, so signing out hides them at once, and a new account
 * starts a new read and ignores the answer of any read still running for the old one.
 */
export function injectOwnActivity(tabPath: string): Signal<OwnActivityState> {
  const auth = inject(AuthService);
  const answered = signal<{ reader: string; result: DashboardResult } | undefined>(undefined);
  const reader = computed(() => readerKey(auth.state()));

  void auth.load();

  effect((onCleanup) => {
    const key = reader();
    let current = true;

    onCleanup(() => (current = false));
    untracked(() => answered.set(undefined));

    if (key !== null) {
      void auth.loadDashboard().then((result) => {
        if (current) {
          answered.set({ reader: key, result });
        }
      });
    }
  });

  return computed(() => {
    const answer = answered();

    return ownActivityState(auth.state(), answer?.reader === reader() ? answer?.result : undefined, tabPath);
  });
}

export function ownActivityState(
  session: SessionState,
  result: DashboardResult | undefined,
  tabPath: string,
): OwnActivityState {
  if (session.status === 'signedOut' || result?.status === 'signedOut') {
    return {
      kind: 'not-enough-data',
      summary: 'Sign in to see your own matches. Only your account can see them.',
      link: { label: 'Sign in', path: '/sign-in', queryParams: { next: tabPath } },
    };
  }

  if (session.status === 'unavailable' || result?.status === 'unavailable') {
    return { kind: 'unavailable' };
  }

  if (session.status === 'loading' || result === undefined) {
    return { kind: 'loading' };
  }

  if (!result.dashboard.linked) {
    return {
      kind: 'not-enough-data',
      summary: 'Link the desktop app to this account to see your matches here.',
      link: ACCOUNT_LINK,
    };
  }

  if (result.dashboard.stats.matches === 0) {
    return {
      kind: 'not-enough-data',
      summary: 'No matches yet. They appear here after the desktop app uploads one.',
      link: ACCOUNT_LINK,
    };
  }

  return { kind: 'ready', activity: result.dashboard.stats.activity, truncated: result.dashboard.truncated };
}

export function ownActivityRows(rows: readonly OwnActivityRow[]): OwnActivityRowView[] {
  return rows.map((row) => ({
    label: row.label,
    matches: row.matches,
    winRate: row.winRate === null ? 'No results' : `${Math.round(row.winRate * 100)}%`,
    barPercent: row.winRate === null ? 0 : row.winRate * 100,
  }));
}

/** Changes when the account or its link changes; null when nobody is signed in. */
function readerKey(session: SessionState): string | null {
  return session.status === 'signedIn'
    ? JSON.stringify([session.account.provider, session.account.email, session.account.createdAt, session.player?.name])
    : null;
}
