import { provideZonelessChangeDetection, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService, type DashboardResult } from '../../../core/auth/auth.service';
import { dashboardStats } from '../../../core/auth/own-dashboard.fixtures';
import { injectOwnActivity, ownActivityRows, type OwnActivityState } from './own-activity';

const account = (email: string) => ({ email, provider: 'discord', createdAt: '2026-01-01T00:00:00Z' });
const ready: DashboardResult = {
  status: 'ready',
  dashboard: { linked: true, player: { name: 'Tony', avatarUrl: null }, truncated: false, stats: dashboardStats() },
};

describe('injectOwnActivity', () => {
  let auth: AuthService;
  let state: Signal<OwnActivityState>;
  let answers: ((answer: DashboardResult) => void)[];

  const settle = async (): Promise<void> => {
    TestBed.tick();
    await Promise.resolve();
    await Promise.resolve();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    auth = TestBed.inject(AuthService);
    answers = [];
    spyOn(auth, 'load').and.resolveTo({ status: 'loading' });
    spyOn(auth, 'loadDashboard').and.callFake(
      () => new Promise<DashboardResult>((resolve) => answers.push(resolve)),
    );
    state = TestBed.runInInjectionContext(() => injectOwnActivity('/community/matches'));
  });

  it('reads nothing and asks to sign in when signed out', async () => {
    auth.state.set({ status: 'signedOut' });
    await settle();

    expect(auth.loadDashboard).not.toHaveBeenCalled();
    expect(state().kind).toBe('not-enough-data');
  });

  it('hides the figures as soon as the account signs out', async () => {
    auth.state.set({ status: 'signedIn', account: account('a@example.com'), player: null, isAdmin: false });
    await settle();
    answers[0](ready);
    await settle();
    expect(state().kind).toBe('ready');

    auth.state.set({ status: 'signedOut' });

    expect(state().kind).toBe('not-enough-data');
  });

  it('ignores a late answer for the previous account after switching', async () => {
    auth.state.set({ status: 'signedIn', account: account('a@example.com'), player: null, isAdmin: false });
    await settle();
    auth.state.set({ status: 'signedIn', account: account('b@example.com'), player: null, isAdmin: false });
    await settle();

    answers[0](ready);
    await settle();
    expect(state().kind).toBe('loading');

    answers[1]({ status: 'ready', dashboard: { linked: false } });
    await settle();
    expect(state().kind).toBe('not-enough-data');
  });
});

describe('ownActivityRows', () => {
  it('labels a win rate and leaves a row with no result empty', () => {
    expect(
      ownActivityRows([
        { label: 'A', matches: 4, wins: 3, losses: 1, winRate: 0.75 },
        { label: 'B', matches: 1, wins: 0, losses: 0, winRate: null },
      ]),
    ).toEqual([
      { label: 'A', matches: 4, winRate: '75%', barPercent: 75 },
      { label: 'B', matches: 1, winRate: 'No results', barPercent: 0 },
    ]);
  });
});
