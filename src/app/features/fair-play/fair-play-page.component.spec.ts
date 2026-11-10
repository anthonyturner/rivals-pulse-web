import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FairPlayPageComponent, OVERWOLF_GAME_COMPLIANCE_URL } from './fair-play-page.component';

describe('FairPlayPageComponent', () => {
  let fixture: ComponentFixture<FairPlayPageComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FairPlayPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FairPlayPageComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  const flat = (node: Element | null): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const section = (id: string): string => {
    const element = page.querySelector(`#${id}`);
    expect(element).withContext(`section #${id}`).toBeTruthy();

    return flat(element);
  };

  it('has one h1 and a labelled h2 section for each point, summary first', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);

    const ids = ['summary', 'not-shown', 'collected', 'opt-out', 'policies'];
    expect(Array.from(page.querySelectorAll('section')).map((element) => element.id)).toEqual(ids);

    for (const id of ids) {
      expect(page.querySelector(`#${id}-title`)?.tagName).withContext(id).toBe('H2');
      expect(page.querySelector(`#${id}`)?.getAttribute('aria-labelledby')).toBe(`${id}-title`);
    }
  });

  it('says the app is not released and describes how it works at launch, never as a live app', () => {
    const summary = section('summary');

    expect(summary).toContain('The RivalsPulse app is not released yet');
    expect(summary).toContain('in development testing and is not on Overwolf');
    expect(summary).toContain('designed to work at launch');
    expect(section('collected')).toContain('At launch, uploads will be automatic');
    expect(flat(page)).not.toMatch(/\bis uploaded\b|\bare uploaded\b|uploaded today|uploads today/i);
  });

  it('says plainly that it stores scoreboard lines and anonymous hero timelines of other players', () => {
    const collected = section('collected');

    expect(collected).toContain('A scoreboard line for every human player');
    expect(collected).toContain('will be stored on our server');
    expect(collected).toContain('in-game name, player id, team, hero, kills, deaths, assists, final hits');
    expect(collected).toContain('any RivalsPulse app user will be able to look a player up');
    expect(collected).toContain('players who never installed the app');
    expect(collected).toContain('An anonymous hero timeline for every player');
    expect(collected).toContain('with no player id and no name');
    expect(collected).toContain('can in practice be linked back to a scoreboard line');
    expect(section('summary')).toContain('store information about other players');
  });

  it('never claims that nothing is collected about other players', () => {
    expect(flat(page)).not.toMatch(/no data|nothing (is )?(stored|collected)|never (store|collect)s? (any )?(data|information) about/i);
  });

  it("shows no other player's damage or healing, and only a count of an opponent's ultimates", () => {
    const notShown = section('not-shown');

    expect(notShown).toContain("Other players' damage, healing, accuracy or damage blocked");
    expect(notShown).toContain("never show you, store or share another player's damage, healing, accuracy or damage blocked");
    expect(notShown).toContain('The most the overlay is allowed to show about an opponent');
    expect(notShown).toContain('a count of how many times they have used it');
    expect(notShown).toContain('Today it shows nothing about it');
    expect(notShown).toContain('never show their charge or timing');
    expect(notShown).toContain('no feature of the app predicts');
  });

  it("says during your own live match the app doesn't look up or show another player's history or profile, at launch", () => {
    expect(section('not-shown')).toContain(
      "At launch, during your own live match, the app doesn't look up or show another player's scoreboard history or profile.",
    );
  });

  it('claims nothing about per-player figures from your own matches', () => {
    expect(flat(page)).not.toMatch(/your own matches|per-player (figures|stats)/i);
  });

  it('discloses Pulse Records: single-match figures, names only by choice, others as Anonymous', () => {
    const collected = section('collected');
    const link = page.querySelector('#collected a[href="/privacy#pulse-records"]');

    expect(link).toBeTruthy();
    expect(collected).toContain('Pulse Records publishes the highest single-match figures');
    expect(collected).toContain('only if they linked an account and switched their name on');
    expect(collected).toContain('Other players\' kills, assists and final hits appear too, as "Anonymous"');
    expect(collected).toContain('never installed the app and never agreed to it');
    expect(section('not-shown')).toContain('apart from Pulse Records');
    expect(collected).toContain('apart from Pulse Records below');
  });

  it('says Pulse Records already shows matches from development builds, though the app has not launched', () => {
    expect(section('collected')).toContain('already does so today from matches played on development builds');
  });

  it('keeps live teammate charge on your own overlay, unstored, and the opponent count as a rule that shows nothing today', () => {
    const collected = section('collected');

    expect(collected).toContain("the overlay will show your teammates' ultimate charge on your own screen");
    expect(collected).toContain("a count of their uses, which today it does not show");
    expect(collected).toContain('Neither is stored or sent anywhere');
  });

  it("does not hedge against the FAQ's confident ban answer", () => {
    const policies = section('policies');

    expect(policies).not.toContain('not a guarantee');
    expect(policies).toContain('what the game allows is NetEase');
    expect(policies).toContain('explains what our answer on bans rests on');
  });

  it('words bans as ban rates only, never as advice, and shows no ban figures on the site', () => {
    const notShown = section('not-shown');

    expect(notShown).toContain('shown only as ban rates');
    expect(notShown).toContain('the app never suggests which hero to ban');
    expect(notShown).toContain('This website shows no ban figures today');
  });

  it("publishes the recorder's own figures as averages per hero, apart from Pulse Records, held back until enough players", () => {
    const collected = section('collected');

    expect(collected).toContain('as averages per hero, apart from Pulse Records below');
    expect(collected).toContain('with the kills and assists soon after each use');
    expect(collected).toContain('held back until enough different players have contributed');
    expect(collected).toContain('can still mostly reflect one player');
  });

  it('says there is no opt-out yet, without a coming-soon section', () => {
    const optOut = section('opt-out');

    expect(optOut).toContain('An opt-out does not exist yet');
    expect(section('summary')).toContain('There is no opt-out');
    expect(flat(page)).not.toMatch(/coming soon/i);
    expect(section('collected')).toContain('will have no setting to turn them off');
  });

  it("calls NetEase's and Overwolf's rules policies, cites Overwolf's Game compliance section with a date, and never says laws", () => {
    const policies = section('policies');
    const link = page.querySelector<HTMLAnchorElement>('#policies a[target="_blank"]');

    expect(link?.getAttribute('href')).toBe(OVERWOLF_GAME_COMPLIANCE_URL);
    expect(link?.rel).toContain('noopener');
    expect(policies).toContain("NetEase's game compliance policy");
    expect(policies).toContain('last checked on 10 November 2026');
    expect(policies).toContain("Overwolf's summary of NetEase's policy, not NetEase's full text, and policies can change");
    expect(policies).toContain('not affiliated with NetEase, Marvel or Overwolf');
    expect(flat(page)).not.toMatch(/\blaws?\b/i);
  });

  it('is plain about what is unconfirmed: the averages reading and legal review', () => {
    const policies = section('policies');

    expect(policies).toContain('have not asked Overwolf or NetEase to confirm it');
    expect(policies).toContain('No lawyer has reviewed this page');
  });

  it('links the privacy notes and the FAQ ban answer', () => {
    const hrefs = Array.from(page.querySelectorAll('a')).map((link) => link.getAttribute('href'));

    expect(hrefs).toContain('/privacy');
    expect(hrefs.some((href) => href?.startsWith('/faq'))).toBeTrue();
  });

  it('does not promise safety', () => {
    expect(flat(page)).not.toMatch(/\bsafe\b|ban-proof|risk-free|100%/i);
  });
});
