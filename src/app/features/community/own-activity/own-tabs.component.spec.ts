import { provideZonelessChangeDetection, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService, type DashboardResult } from '../../../core/auth/auth.service';
import { dashboardStats } from '../../../core/auth/own-dashboard.fixtures';
import type { OwnActivity } from '../../../core/auth/own-dashboard.types';
import { InsightsTabComponent } from '../insights-tab/insights-tab.component';
import { MatchesTabComponent } from '../matches-tab/matches-tab.component';

const row = (label: string) => ({ label, matches: 4, wins: 3, losses: 1, winRate: 0.75 });
const ACTIVITY: OwnActivity = {
  maps: [row('Tokyo 2099')],
  modes: [row('Quick Match')],
  days: [row('2026-10-29')],
  weekdays: [row('Thursday')],
  timesOfDay: [row('08:00 to 11:59')],
  sessionPlaces: [row('Match 1')],
};
const readyResult = (truncated: boolean): DashboardResult => ({
  status: 'ready',
  dashboard: {
    linked: true,
    player: { name: 'Tony', avatarUrl: null },
    truncated,
    stats: dashboardStats({ activity: ACTIVITY }),
  },
});

describe('the private Community tabs', () => {
  async function render(component: Type<unknown>, result: DashboardResult): Promise<string> {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });

    const auth = TestBed.inject(AuthService);

    spyOn(auth, 'load').and.resolveTo({ status: 'loading' });
    spyOn(auth, 'loadDashboard').and.resolveTo(result);
    auth.state.set({
      status: 'signedIn',
      account: { email: 'a@example.com', provider: 'discord', createdAt: '2026-01-01T00:00:00Z' },
      player: null,
    });

    const fixture = TestBed.createComponent(component);

    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();

    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the account its maps, modes and days, and says who can see them', async () => {
    const text = await render(MatchesTabComponent, readyResult(false));

    expect(text).toContain('Tokyo 2099');
    expect(text).toContain('Quick Match');
    expect(text).toContain('Thu 29 Oct');
    expect(text).toContain('75%');
    expect(text).toContain('Only your account can see this.');
    expect(text).toContain('Days are UTC.');
    expect(text).not.toContain('2,000');
  });

  it('shows the account when it plays, in UTC, and says when matches were cut off', async () => {
    const text = await render(InsightsTabComponent, readyResult(true));

    expect(text).toContain('Thursday');
    expect(text).toContain('08:00 to 11:59');
    expect(text).toContain('Match 1');
    expect(text).toContain('all days and times are UTC');
    expect(text).toContain('Your newest 2,000 matches.');
  });

  it('shows no figures for an account with no link', async () => {
    const text = await render(MatchesTabComponent, { status: 'ready', dashboard: { linked: false } });

    expect(text).toContain('Link the desktop app');
    expect(text).not.toContain('Tokyo 2099');
  });

  it('says when the matches cannot be read', async () => {
    expect(await render(InsightsTabComponent, { status: 'unavailable' })).toContain('could not be loaded');
  });

  it('says when a linked account has no matches', async () => {
    const empty: DashboardResult = {
      status: 'ready',
      dashboard: { linked: true, player: { name: 'Tony', avatarUrl: null }, truncated: false, stats: dashboardStats({ matches: 0 }) },
    };

    expect(await render(MatchesTabComponent, empty)).toContain('No matches yet');
  });
});
