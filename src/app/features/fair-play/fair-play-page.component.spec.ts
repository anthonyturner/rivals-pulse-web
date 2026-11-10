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

    const ids = ['summary', 'not-shown', 'collected', 'coming-soon', 'policies'];
    expect(Array.from(page.querySelectorAll('section')).map((element) => element.id)).toEqual(ids);

    for (const id of ids) {
      expect(page.querySelector(`#${id}-title`)?.tagName).withContext(id).toBe('H2');
      expect(page.querySelector(`#${id}`)?.getAttribute('aria-labelledby')).toBe(`${id}-title`);
    }
  });

  it('says plainly that it stores scoreboard lines and anonymous hero timelines of other players', () => {
    const collected = section('collected');

    expect(collected).toContain('A scoreboard line for every human player');
    expect(collected).toContain('in-game name, player id, team, hero, kills, deaths, assists, final hits');
    expect(collected).toContain('any RivalsPulse app user can look a player up');
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
    expect(notShown).toContain('never stores them for, or shares them with, another app user');
    expect(notShown).toContain('a count of how many times each opponent has used their ultimate');
    expect(notShown).toContain('nothing about their charge or timing');
    expect(notShown).toContain('no feature of the app predicts');
  });

  it('keeps live teammate charge and the opponent count on the overlay, unstored', () => {
    expect(section('collected')).toContain(
      "teammates' ultimate charge and a count of each opponent's ultimates. Neither is stored or sent anywhere",
    );
  });

  it('words bans as ban rates only, never as advice, and shows no ban figures on the site', () => {
    const notShown = section('not-shown');

    expect(notShown).toContain('shown only as ban rates');
    expect(notShown).toContain('the app never suggests which hero to ban');
    expect(notShown).toContain('This website shows no ban figures today');
  });

  it("publishes the recorder's own figures only as averages per hero, held back until enough players", () => {
    const collected = section('collected');

    expect(collected).toContain('only as averages per hero');
    expect(collected).toContain('held back until enough different players have contributed');
    expect(collected).toContain('can still mostly reflect one player');
  });

  it('words the opt-out and lobby-or-after-match lookups as coming soon, not live', () => {
    const comingSoon = section('coming-soon');

    expect(comingSoon).toContain('not available yet');
    expect(comingSoon).toContain('An opt-out');
    expect(comingSoon).toContain('Lookups in the lobby or after a match only');
    expect(comingSoon).toContain('Until this ships');
    expect(section('summary')).toContain('coming soon and are not available yet');
    expect(section('collected')).toContain('no setting to turn them off');
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
