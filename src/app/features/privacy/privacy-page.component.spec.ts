import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ADSENSE_CONFIG, AdSenseConfig } from '../../shared/components/ad-slot/adsense/adsense.config';
import { PrivacyPageComponent } from './privacy-page.component';
import { EXTENDED_UPLOAD_FIELDS, EXTENDED_UPLOAD_STATUS, TODAY_UPLOAD_FIELDS } from './privacy-notes.data';

describe('PrivacyPageComponent', () => {
  let page: HTMLElement;

  async function render(config?: AdSenseConfig): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [PrivacyPageComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        ...(config ? [{ provide: ADSENSE_CONFIG, useValue: config }] : []),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PrivacyPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    page = await render();
  });

  const section = (id: string): HTMLElement => {
    const element = page.querySelector(`#${id}`) as HTMLElement | null;
    expect(element).withContext(`section #${id}`).toBeTruthy();
    return element as HTMLElement;
  };

  const itemLabels = (id: string): string[] =>
    Array.from(section(id).querySelectorAll('li')).map((item) => item.textContent ?? '');

  it('names the page and has one h1', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);
    expect(page.querySelector('h1')?.textContent).toContain('Privacy');
  });

  it('lists every field uploaded today, including names and player ids', () => {
    const items = itemLabels('uploaded-today');

    for (const field of TODAY_UPLOAD_FIELDS) {
      expect(items.some((text) => text.includes(field.label)))
        .withContext(field.label)
        .toBeTrue();
    }
    expect(TODAY_UPLOAD_FIELDS.map((field) => field.label)).toEqual(
      jasmine.arrayContaining(['In-game name', 'Player id', 'Match length', 'Match id']),
    );
  });

  it('lists every extended field and marks them as being added', () => {
    expect(EXTENDED_UPLOAD_STATUS).toBe('being-added');
    const extended = section('extended-fields');
    const items = itemLabels('extended-fields');

    for (const field of EXTENDED_UPLOAD_FIELDS) {
      expect(items.some((text) => text.includes(field.label)))
        .withContext(field.label)
        .toBeTrue();
    }
    expect(extended.textContent).toContain('being added');
    expect(extended.textContent).toContain('no player');
  });

  it('keeps the kill feed to heroes only', () => {
    const killFeed = EXTENDED_UPLOAD_FIELDS.find((field) => field.label === 'Kill feed');

    expect(killFeed?.detail).toContain('hero');
    expect(killFeed?.detail).toContain('no player names or ids');
  });

  it('promises anonymous aggregates with minimum sample sizes', () => {
    const text = (section('public-numbers').textContent ?? '').toLowerCase();

    expect(text).toContain('anonymous');
    expect(text).toContain('minimum');
    expect(text).toContain('never');
  });

  it('states the retention rule', () => {
    const text = section('retention').textContent ?? '';

    expect(text).toContain('six months');
    expect(text).toContain('half-season');
    expect(text).toContain('no time limit');
    expect(text).toContain('5,000');
  });

  it('says the one-way recorder code is also kept with the own match history', () => {
    const uploads = (section('uploaded-today').textContent ?? '').replace(/\s+/g, ' ');
    const retention = (section('retention').textContent ?? '').replace(/\s+/g, ' ');

    expect(uploads).toContain('also kept next to each match in that history');
    expect(uploads).toContain('link a website account');
    expect(retention).toContain('one-way recorder code kept next to each of its matches');
  });

  it('says uploads are automatic rather than chosen', () => {
    const text = page.textContent ?? '';

    expect(text).toContain('uploaded automatically');
    expect(text).not.toContain('choose to upload');
  });

  it('describes Discord sign-in, what is stored, the sign-in cookie and deletion', () => {
    const text = section('accounts').textContent ?? '';

    expect(text).toContain('Discord');
    expect(text).toContain('Discord user id');
    expect(text).toContain('email address');
    expect(text).toContain('rp_session');
    expect(text).toContain('Deleting your account');
  });

  it('says how long the sign-in lasts as the code behaves, and that Supabase sees the IP address', () => {
    const text = (section('accounts').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('until 30 days pass without a visit');
    expect(text).not.toContain('up to 30 days');
    expect(text).toContain('IP address');
    expect(text).toContain('talks to Supabase directly');
  });

  it('summarises the cookies and the direct Supabase contact truthfully', () => {
    const text = (section('summary').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('rp_pkce');
    expect(text).toContain('talks to Discord and to Supabase');
    expect(text).not.toContain('If you never sign in, the site sets no cookies');
  });

  it('no longer claims there are no accounts, no login or no cookies', () => {
    const text = (page.textContent ?? '').toLowerCase();

    expect(text).not.toContain('no accounts');
    expect(text).not.toContain('no login');
    expect(text).not.toContain('no cookies of its own and');
  });

  it('explains self-service deletion on the account page, not a request in Discord', () => {
    const accounts = section('accounts');
    const text = (accounts.textContent ?? '').replace(/\s+/g, ' ');

    expect(accounts.querySelector('a[href="/account"]')).withContext('the link to the account page').toBeTruthy();
    expect(text).toContain('Remove account and forget me');
    expect(text).toContain('Signing in with Discord again');
    expect(text).not.toContain('ask for your account to be deleted');
    expect(text).not.toContain('does not have a delete button');
    expect(text).not.toContain('straight away');
    expect(text).toContain('last ten minutes');
    expect(text).toContain('Supabase keeps sign-in and request log entries');
    expect(text).toContain('IP address');
    expect(text).toContain('cannot be undone');
    expect(accounts.querySelector('a[href^="https://discord.gg/"]')).toBeNull();
  });

  it('says what linking the desktop app stores, how long a code lives and how to undo it', () => {
    const text = (section('accounts').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('Linking the desktop app');
    expect(text).toContain('in-game name and id');
    expect(text).toContain('Overwolf account avatar');
    expect(text).toContain('cannot be turned back into it');
    expect(text).toContain('expires after ten minutes');
    expect(text).toContain('the new ones replace the ones we stored');
    expect(text).toContain('name and avatar updates');
    expect(text).toContain('You can unlink at any time');
    expect(text).not.toContain('An account is not linked to your in-game name');
  });

  it('discloses Google AdSense in the summary and its own section', () => {
    const summary = (section('summary').textContent ?? '').replace(/\s+/g, ' ');
    const advertising = section('advertising');
    const text = (advertising.textContent ?? '').replace(/\s+/g, ' ');

    expect(summary).toContain('Google AdSense');
    expect(text).toContain('IP address');
    expect(text).toContain('cookies or similar browser storage');
    expect(text).toContain('never data about you');
    expect(advertising.querySelector('a[href="https://policies.google.com/technologies/partner-sites"]'))
      .withContext("the link to Google's partner-sites policy")
      .toBeTruthy();
  });

  it('explains the consent choice and how to change it, and says no ads are shown while none are configured', () => {
    const text = (section('advertising').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('Do not consent');
    expect(text).toContain('Manage options');
    expect(text).toContain('European Economic Area, the United Kingdom or Switzerland');
    expect(text).toContain('Privacy and cookie settings');
    expect(text).toContain('appears only where the message applies');
    expect(text).toContain('No ads are shown yet');
    expect(text).not.toContain('personalised or non-personalised');
  });

  it('says where ads appear and what a visitor who has not agreed sees once an ad unit is configured', async () => {
    page = await render({ publisherId: 'ca-pub-1', slotIds: { rectangle: '1234567890' } });
    const text = (section('advertising').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('Google ads appear in one box in the sidebar, on every page except the home page');
    expect(text).toContain('shows a RivalsPulse advert instead');
    expect(text).not.toContain('No ads are shown yet');
  });

  it('no longer says the website has no advertising', () => {
    const text = (section('more').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).not.toContain('also covers advertising');
  });
});
