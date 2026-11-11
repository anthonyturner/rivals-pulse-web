import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ADSENSE_CONFIG, AdSenseConfig } from '../../shared/components/ad-slot/adsense/adsense.config';
import { PrivacyPageComponent } from './privacy-page.component';
import {
  EXTENDED_UPLOAD_FIELDS,
  EXTENDED_UPLOAD_STATUS,
  PLANNED_UPLOAD_FIELDS,
  PULSE_RECORDS_STATUS,
  TODAY_UPLOAD_FIELDS,
} from './privacy-notes.data';

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

  it('lists every extended field and says the app uploads them', () => {
    expect(EXTENDED_UPLOAD_STATUS).toBe('uploaded');
    const extended = section('extended-fields');
    const items = itemLabels('extended-fields');

    for (const field of EXTENDED_UPLOAD_FIELDS) {
      expect(items.some((text) => text.includes(field.label)))
        .withContext(field.label)
        .toBeTrue();
    }
    expect(extended.querySelector('h2')?.textContent).toContain('What the app will also upload');
    expect(extended.textContent).toContain('the app uploads these fields');
    expect(extended.textContent).not.toContain('being added');
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

  describe('Pulse Records', () => {
    const records = (): string => (section('pulse-records').textContent ?? '').replace(/\s+/g, ' ');

    it('no longer says the page is closed once it is open, and links to it', () => {
      expect(PULSE_RECORDS_STATUS).toBe('open');
      expect(records()).not.toContain('not open yet');
      expect(records()).not.toContain('published until it opens');
      expect(section('summary').textContent).not.toContain('not open yet');
      expect(section('pulse-records').querySelector('a[href="/stats/records"]')).toBeTruthy();
    });

    it('says a name needs a linked account and a switch that is off until it is turned on', () => {
      const text = records();

      expect(text).toContain('Only if you signed in, linked your account to the desktop app');
      expect(text).toContain('It is off until you switch it on, and you can switch it off at any time');
      expect(text).toContain('we cannot check that it is yours');
    });

    it('says anonymous entries are published lines from players who did not agree', () => {
      const text = records();

      expect(text).toContain('Anonymous entries are published lines from players who did not agree');
      expect(text).toContain('including players who never installed the app');
      expect(text).toContain('it is still a published line from a match that player took part in');
      expect(text).toContain('A player whose account is linked is never shown as "Anonymous"');
      expect(text).toContain("Lines of yours that another player's app uploaded are left off too, not shown as \"Anonymous\"");
    });

    it('says how to be taken off, and that the site shows no id, match, map or date', () => {
      const text = records();

      expect(text).toContain('no player id, no match, map or date');
      expect(text).toContain('Switching your name off removes your name and your entries within a few minutes');
      expect(text).toContain('can then show as "Anonymous" until it is deleted');
    });

    it('is the stated exception in the summary and the publishing list, so neither promises no names', () => {
      const summary = (section('summary').textContent ?? '').replace(/\s+/g, ' ');
      const published = (section('public-numbers').textContent ?? '').replace(/\s+/g, ' ');

      expect(summary).toContain('Apart from Pulse Records');
      expect(summary).toContain('some entries come from players who never agreed to anything');
      expect(published).toContain('Apart from Pulse Records, only anonymous aggregates');
      expect(published).toContain('In-game names appear only on Pulse Records');
      expect(published).toContain('one match is enough for an entry there');
      expect(section('uploaded-today').textContent).not.toContain('never published on this website');
    });

    it('says the account page shows the name publicly only if the player switches it on', () => {
      const text = (section('accounts').textContent ?? '').replace(/\s+/g, ' ');

      expect(text).toContain('only if you switch it on, which entries on Pulse Records carry your name');
      expect(text).toContain('Your avatar is never shown there');
      expect(text).toContain('The one thing you can choose to make public is your in-game name');
    });
  });

  it('does not promise that every figure counts a match once: Insights counts it once per uploading player', () => {
    const text = (section('public-numbers').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).not.toContain('cannot weigh twice');
    expect(text).toContain('The "When the community plays and wins" section of the Stats overview');
    expect(text).toContain('counts it once for each player who uploaded it');
    expect(text).toContain('One match can therefore weigh twice there');
    expect(text).toContain('"Community matches" section of the Stats overview count it once');
  });

  it('says hero averages need 2 players but can mostly reflect one player', () => {
    const text = section('public-numbers').textContent ?? '';
    expect(text).not.toContain('are planned');
    expect(text).toContain('own figures');
    expect(text).not.toContain("never show one player's numbers");
    expect(text).toContain('once 2 different players have');
    expect(text).toContain('one player can supply nearly all of it');
  });

  it('says how specialist and flex win rates are made public: pooled, with a minimum and no per-player figure', () => {
    const text = (section('public-numbers').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('Specialist and flex win rates');
    expect(text).toContain('keeps nothing per player');
    expect(text).toContain('at least 5 players, 2 uploading players and 50 matches');
    expect(text).toContain('A line with no player id is left out');
  });

  it('lists ability and ultimate use as planned, apart from the extended status', () => {
    expect(EXTENDED_UPLOAD_FIELDS.map((field) => field.label)).not.toContain('Ability and ultimate use');
    const planned = section('planned-fields').textContent ?? '';
    expect(planned).toContain('uploading player');
    expect(planned).toContain('not whether it hit anyone');
    expect(planned).toContain('Never uploaded for other players');
  });

  it('lists hero changes as planned, by team and time, with no player named', () => {
    const entry = PLANNED_UPLOAD_FIELDS.find((field) => field.label === 'Hero changes during the match');
    const planned = section('planned-fields').textContent ?? '';

    expect(entry?.detail).toContain('carries no player names or ids');
    expect(entry?.detail).toContain('seconds into the match');
    expect(planned).toContain('Hero changes during the match');
    expect(planned).toContain('stored once per match');
    expect(entry?.detail).toContain('one-way code of the player who uploaded it');
    expect(EXTENDED_UPLOAD_FIELDS.map((field) => field.label)).not.toContain('Hero changes during the match');
  });

  it('says the app is not released yet and frames the uploads as how it works at launch', () => {
    const summary = (section('summary').textContent ?? '').replace(/\s+/g, ' ');
    const uploads = (section('uploaded-today').textContent ?? '').replace(/\s+/g, ' ');

    expect(summary).toContain('The RivalsPulse desktop app is not released yet');
    expect(summary).toContain('not on Overwolf');
    expect(section('uploaded-today-title').textContent).toBe('What the app uploads at launch');
    expect(uploads).toContain('At launch, the desktop app will upload the matches it records by default');
    expect(uploads).toContain('none of them released');
    expect(page.textContent).not.toContain('versions released so far');
    expect(page.textContent).not.toContain('Older versions of the app');
  });

  it('says a hero change can be linked back to a scoreboard line, as the Fair play page does', () => {
    const entry = PLANNED_UPLOAD_FIELDS.find((field) => field.label === 'Hero changes during the match');

    expect(entry?.detail).toContain('in practice be linked back to a scoreboard line');
    expect(EXTENDED_UPLOAD_FIELDS.map((field) => field.label)).not.toContain('Hero changes during the match');
  });

  it('links the Fair play and privacy page from the short version', () => {
    expect(section('summary').querySelector('a[href="/fair-play"]')).toBeTruthy();
  });

  it('states the retention rule', () => {
    const text = section('retention').textContent ?? '';

    expect(text).not.toContain('being added');
    expect(text).toContain('six months');
    expect(text).toContain('half-season');
    expect(text.replace(/\s+/g, ' ')).toContain('hero changes once the app sends them (with the one-way recorder code stored next to each one), are kept for the same time and deleted with them');
    expect(text).toContain('no time limit');
    expect(text).toContain('5,000');
  });

  it('says the one-way recorder code is also kept with the own match history', () => {
    const uploads = (section('uploaded-today').textContent ?? '').replace(/\s+/g, ' ');
    const retention = (section('retention').textContent ?? '').replace(/\s+/g, ' ');

    expect(uploads).toContain('also kept next to each match in that history');
    expect(uploads).toContain('with every hero change that player uploads');
    expect(uploads).toContain('link a website account');
    expect(retention).toContain('one-way recorder code kept next to each of its matches');
  });

  it('says who can read uploaded match histories today, and what changes', () => {
    const uploads = (section('uploaded-today').textContent ?? '').replace(/\s+/g, ' ');

    expect(uploads).toContain('anyone who takes that key out of the app can read every uploaded match history');
    expect(uploads).toContain('read only the matches that player uploaded');
    expect(uploads).toContain('the public key will no longer read match histories');
  });

  it('says uploads are on by default and can be turned off in Settings, under Privacy', () => {
    const uploads = (section('uploaded-today').textContent ?? '').replace(/\s+/g, ' ');

    expect(uploads).toContain("A player can turn uploading off in the app's Settings, under Privacy");
    expect(uploads).toContain('"Upload my matches" switch, which is on until they turn it off');
    expect(uploads).toContain("While it is off, nothing will be uploaded and matches will still save on that player's own PC");
    expect(uploads).toContain('A match finished while it is off will never be uploaded later');
    expect(uploads).toContain('restoring a backup file can turn uploading off but never on');
    expect(uploads).toContain(
      'A match that was already waiting to upload when the switch was turned off will be sent once it is turned back on',
    );
    expect(uploads).toContain('Turning it off will not delete matches that were already uploaded');
    expect(page.textContent).not.toMatch(/no setting to turn/i);
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
    expect(text).toContain('name and avatar updates, link checks, unlinks and wrong guesses');
    expect(text).toContain('You can unlink at any time on your account page, which deletes the link, or in the desktop app, which deletes the link and any code you asked for and have not used');
    expect(text).toContain('never your email or account id');
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

  it('discloses Vercel Web Analytics in the summary and its own section after the advertising one', () => {
    const summary = (section('summary').textContent ?? '').replace(/\s+/g, ' ');
    const analytics = section('analytics');
    const text = (analytics.textContent ?? '').replace(/\s+/g, ' ');

    expect(summary).toContain('Vercel Web Analytics');
    expect(summary).not.toContain('no analytics');
    expect(text).toContain('sets no cookies');
    expect(text).toContain('only aggregate figures');
    expect(text).toContain('the page address, the page you came from, and your browser and device type');
    expect(text).toContain('without keeping your IP address');
    expect(section('advertising').nextElementSibling).toBe(analytics);
  });

  it('says hero pages fetch video pictures from YouTube (Google) and a player loads only on play', () => {
    const summary = (section('summary').textContent ?? '').replace(/\s+/g, ' ');
    const videos = section('videos');
    const text = (videos.textContent ?? '').replace(/\s+/g, ' ');

    expect(summary).toContain('Hero pages fetch video pictures from YouTube (Google)');
    expect(text).toContain("fetches those pictures from YouTube's image host, which Google runs");
    expect(text).toContain('before you press anything');
    expect(summary).toContain('their players load only when you press play');
    expect(summary).toContain('Players on hero guide, strategist guide and video tutorial pages load without a press');
    expect(text).toContain('loads from YouTube only when you press play');
    expect(videos.querySelector('a[href="https://policies.google.com/privacy"]')).toBeTruthy();
  });

  it('does not claim the other YouTube players wait for a press', () => {
    const text = (section('videos').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain('still show YouTube players that load without a press');
  });

  it('says players may use cookies and that the consent message does not cover videos', () => {
    const text = (section('videos').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).toContain("may set or read YouTube's own cookies");
    expect(text).toContain('these pictures and players do not wait for your answer');
  });

  it('no longer says the website has no advertising', () => {
    const text = (section('more').textContent ?? '').replace(/\s+/g, ' ');

    expect(text).not.toContain('also covers advertising');
  });

  describe('contents list', () => {
    const sections = (): HTMLElement[] => Array.from(page.querySelectorAll<HTMLElement>('section[id]'));
    const links = (): HTMLAnchorElement[] => Array.from(page.querySelectorAll<HTMLAnchorElement>('nav a'));

    it('is one nav labelled "On this page", and the page has no main of its own', () => {
      const nav = page.querySelector('nav');

      expect(page.querySelectorAll('nav').length).toBe(1);
      expect(nav?.getAttribute('aria-labelledby')).toBe('privacy-toc-title');
      expect(page.querySelector('#privacy-toc-title')?.textContent).toBe('On this page');
      expect(page.querySelectorAll('main').length).toBe(0);
    });

    it('has one entry for each section, in page order, worded like its heading', () => {
      expect(links().map((link) => link.textContent?.trim() ?? '')).toEqual(
        sections().map((section) => section.querySelector('h2')?.textContent?.trim() ?? ''),
      );
    });

    it('points each entry at its section by fragment', () => {
      expect(links().map((link) => new URL(link.href).hash.slice(1))).toEqual(sections().map((section) => section.id));
    });
  });
});
