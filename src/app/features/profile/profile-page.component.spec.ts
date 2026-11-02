import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService, type DashboardResult } from '../../core/auth/auth.service';
import { emptyDashboard, linkedDashboard } from '../../core/auth/own-dashboard.fixtures';
import { heroOf } from '../insights/hero-matchup.fixtures';
import { ProfilePageComponent } from './profile-page.component';
import { DEPTH_NOTE } from './profile-view';

describe('ProfilePageComponent', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<ProfilePageComponent>;
  let loadDashboard: jasmine.Spy<() => Promise<DashboardResult>>;

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => host().textContent ?? '';

  async function open(...answers: DashboardResult[]): Promise<void> {
    loadDashboard = jasmine.createSpy('loadDashboard').and.returnValues(...answers.map((a) => Promise.resolve(a)));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { loadDashboard } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    http.expectOne('/api/heroes').flush([heroOf('storm', 'Storm', 'Duelist'), heroOf('hela', 'Hela', 'Duelist')]);
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('says it is loading until the stats arrive', async () => {
    loadDashboard = jasmine.createSpy('loadDashboard').and.returnValue(new Promise(() => undefined));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { loadDashboard } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();

    expect(host().querySelector('[aria-busy="true"]')?.textContent).toContain('Loading your stats');
    http.expectOne('/api/heroes').flush([]);
  });

  describe('for an account with no link', () => {
    beforeEach(() => open({ status: 'ready', dashboard: { linked: false } }));

    it('explains linking and links to the account page', () => {
      expect(host().querySelector('h2')?.textContent).toContain('Link the desktop app');
      expect(text()).toContain('ask it for a link code');
      expect(host().querySelector('a[href="/account"]')).toBeTruthy();
    });

    it('shows no stats', () => {
      expect(host().querySelector('app-profile-figure-list')).toBeNull();
      expect(host().querySelector('app-player-avatar')).toBeNull();
    });
  });

  describe('for a linked player with no matches', () => {
    beforeEach(() => open({ status: 'ready', dashboard: emptyDashboard() }));

    it('shows who is linked and says matches appear after the app uploads one', () => {
      expect(host().querySelector('.player-name')?.textContent).toBe('Aurora');
      expect(host().querySelector('.player img')?.getAttribute('src')).toBe('https://content.overwolf.com/a.png');
      expect(text()).toContain('No matches yet');
      expect(text()).toContain('Matches appear here after the desktop app uploads one.');
    });

    it('states the depth and what may be missing', () => {
      expect(text()).toContain(DEPTH_NOTE);
    });

    it('shows no zero figures', () => {
      expect(host().querySelector('app-profile-figure-list')).toBeNull();
    });
  });

  describe('when the stats cannot be read', () => {
    beforeEach(() => open({ status: 'unavailable' }, { status: 'ready', dashboard: linkedDashboard() }));

    it('says so and offers to try again', () => {
      expect(host().querySelector('[role="status"] h2')?.textContent).toContain('unavailable');
      expect(host().querySelector('button')?.textContent).toContain('Try again');
    });

    it('asks again, and shows the stats when the second answer is good', async () => {
      (host().querySelector('button') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(loadDashboard).toHaveBeenCalledTimes(2);
      expect(host().querySelector('.player-name')?.textContent).toBe('Aurora');
    });

    it('moves focus to the result heading after a retry, since the button is gone', async () => {
      document.body.appendChild(host());
      (host().querySelector('button') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(host().querySelector('.player-name'));
      host().remove();
    });
  });

  describe('for a linked player with matches', () => {
    beforeEach(() => open({ status: 'ready', dashboard: linkedDashboard() }));

    it('shows the avatar and the in-game name', () => {
      expect(host().querySelector('.player-name')?.textContent).toBe('Aurora');
      expect(host().querySelector('.player img')?.getAttribute('src')).toBe('https://content.overwolf.com/a.png');
    });

    it('falls back to the first letter of the name when the avatar does not load', async () => {
      host().querySelector('.player img')?.dispatchEvent(new Event('error'));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(host().querySelector('.player img')).toBeNull();
      expect(host().querySelector('.player .player-avatar--initial')?.textContent?.trim()).toBe('A');
    });

    it('shows no level, rank or Discord handle', () => {
      expect(text()).not.toMatch(/\blevel\b|\brank\b|discord/i);
    });

    it('shows the overview figures', () => {
      expect(text()).toContain('20 matches, played between');
      expect(text()).toContain('55.6%');
      expect(text()).toContain('15.0 / 6.0 / 9.0');
      expect(text()).toContain('8.0');
    });

    it('lists the most played heroes, each linking to the Heroes page', () => {
      const names = Array.from(host().querySelectorAll('app-community-hero-list .name-link')).map((a) =>
        a.textContent?.trim(),
      );

      expect(names).toEqual(['Storm', 'Hela']);
      expect(text()).toContain('66.7%');
    });

    it('shows per-minute figures with their sample sizes, and says not counted for a blank', () => {
      expect(text()).toContain('1,235');
      expect(text()).toContain('From 14 hero-matches.');
      expect(text()).toContain('rough guide');
      expect(text()).toContain('Not counted');
    });

    it('shows records and the streak', () => {
      expect(text()).toContain('Most kills');
      expect(text()).toContain('Hela, Oct 12, 2026');
      expect(text()).toContain('Longest win streak');
    });

    it('lists the latest matches', () => {
      const matches = host().querySelectorAll('.recent .match');

      expect(matches.length).toBe(3);
      expect(matches[0].textContent).toContain('Win');
      expect(matches[0].textContent).toContain('Storm');
      expect(matches[0].textContent).toContain('12 / 4 / 9');
      expect(matches[2].textContent).toContain('No result recorded');
    });

    it('states the depth and what may be missing', () => {
      expect(text()).toContain('about six months');
      expect(text()).toContain('9 October 2026');
    });

    it('has no truncation notice when everything was read', () => {
      expect(host().querySelector('app-notice')).toBeNull();
    });

    it('draws no figure as a bare 0 where the app recorded nothing', () => {
      const blanks = Array.from(host().querySelectorAll('.value--missing')).map((el) => el.textContent);

      expect(blanks.length).toBeGreaterThan(0);
      expect(blanks.every((blank) => blank === 'Not counted')).toBeTrue();
    });
  });

  it('tells the reader when more matches existed than were read', async () => {
    await open({ status: 'ready', dashboard: linkedDashboard({}, true) });

    expect(host().querySelector('app-notice')?.textContent).toContain('more matches than we read');
  });

  it('does not navigate to sign-in when the page was left before a late 401 arrived', async () => {
    let answerLate: (result: DashboardResult) => void = () => undefined;
    loadDashboard = jasmine.createSpy('loadDashboard').and.returnValue(new Promise((resolve) => (answerLate = resolve)));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { loadDashboard } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    http.expectOne('/api/heroes').flush([]);
    fixture.destroy();

    answerLate({ status: 'signedOut' });
    await Promise.resolve();
    await Promise.resolve();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('sends a visitor whose session has ended to sign in, and back here after', async () => {
    loadDashboard = jasmine.createSpy('loadDashboard').and.resolveTo({ status: 'signedOut' });
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { loadDashboard } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    http.expectOne('/api/heroes').flush([]);
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledOnceWith(['/sign-in'], { queryParams: { next: '/profile' } });
  });
});
