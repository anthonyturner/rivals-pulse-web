import { dashboardStats, emptyDashboard, linkedDashboard, recentMatch } from '../../core/auth/own-dashboard.fixtures';
import { heroIdentities } from '../insights/hero-identity';
import { buildProfileView, DEPTH_NOTE, NOT_COUNTED, type ProfileView } from './profile-view';

const IDENTITIES = heroIdentities([
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' },
  { id: 'hela', name: 'Hela', role: 'Duelist', imageUrl: '/images/heroes/hela.png' },
]);

type Ready = Extract<ProfileView, { kind: 'ready' }>;

function ready(stats: Parameters<typeof linkedDashboard>[0] = {}, truncated = false): Ready {
  const view = buildProfileView({ status: 'ready', dashboard: linkedDashboard(stats, truncated) }, IDENTITIES);

  if (view.kind !== 'ready') {
    throw new Error(`Expected a ready view, got ${view.kind}`);
  }

  return view;
}

const figure = (figures: Ready['overview'], label: string) => figures.find((f) => f.label === label);

describe('buildProfileView states', () => {
  it('waits while nothing has answered, and while a signed-out answer sends the visitor away', () => {
    expect(buildProfileView(undefined, IDENTITIES).kind).toBe('loading');
    expect(buildProfileView({ status: 'signedOut' }, IDENTITIES).kind).toBe('loading');
  });

  it('waits for the hero names rather than drawing a hero under a guessed name', () => {
    const view = buildProfileView({ status: 'ready', dashboard: linkedDashboard() }, undefined);

    expect(view.kind).toBe('loading');
  });

  it('is unavailable whether or not the hero names have arrived', () => {
    expect(buildProfileView({ status: 'unavailable' }, undefined).kind).toBe('unavailable');
  });

  it('is not linked for an account with no link', () => {
    expect(buildProfileView({ status: 'ready', dashboard: { linked: false } }, IDENTITIES).kind).toBe('not-linked');
  });

  it('has no matches for a linked player whose app has uploaded none, even before the hero names arrive', () => {
    const view = buildProfileView({ status: 'ready', dashboard: emptyDashboard() }, undefined);

    expect(view).toEqual({ kind: 'no-matches', player: emptyDashboard().player });
  });
});

describe('buildProfileView ready', () => {
  it('counts the matches over their dates, in UTC', () => {
    expect(ready().sample).toBe('20 matches, played between May 20, 2026 and Oct 30, 2026');
    expect(ready({ matches: 1, firstPlayedAt: '2026-10-30T01:00:00Z' }).sample).toBe('1 match, played Oct 30, 2026');
  });

  it('shows the win rate over known results, and says how many matches had none', () => {
    const winRate = figure(ready().overview, 'Win rate');

    expect(winRate?.value).toBe('55.6%');
    expect(winRate?.detail).toBe('10 wins, 8 losses; 2 matches with no result left out');
  });

  it('shows K/D/A as averages over the matches that recorded all three, with the ratio', () => {
    const kda = figure(ready().overview, 'Kills / deaths / assists');

    expect(kda?.value).toBe('15.0 / 6.0 / 9.0');
    expect(kda?.detail).toBe('Average per match over 18 matches. KDA ratio 4.0.');
  });

  it('shows final hits where counted', () => {
    const finalHits = figure(ready().overview, 'Final hits');

    expect(finalHits?.value).toBe('8.0');
    expect(finalHits?.detail).toContain('over 12 matches that counted them');
  });

  it('says not counted, never 0, for every figure with nothing behind it', () => {
    const view = ready({
      winRate: null,
      wins: 0,
      losses: 0,
      kda: null,
      finalHits: null,
      perMinute: { damage: null, healing: null, blocked: null },
      records: { mostKills: null, mostAssists: null, mostFinalHits: null, longestWinStreak: 0 },
    });
    const figures = [...view.overview, ...view.perMinute, ...view.records].filter((f) => f.label !== 'Matches');
    const blank = figures.filter((f) => !f.counted);

    expect(blank.map((f) => f.value)).toEqual(Array(blank.length).fill(NOT_COUNTED));
    expect(blank.map((f) => f.label)).toEqual([
      'Win rate',
      'Kills / deaths / assists',
      'Final hits',
      'Damage per minute',
      'Healing per minute',
      'Blocked per minute',
      'Most kills',
      'Most assists',
      'Most final hits',
    ]);
    expect(figures.filter((f) => f.counted).map((f) => f.label)).toEqual(['Longest win streak']);
  });

  it('shows a per-minute rate with its sample size, and calls a small sample a rough guide', () => {
    const { perMinute } = ready();

    expect(perMinute.map((f) => [f.label, f.value, f.detail])).toEqual([
      ['Damage per minute', '1,235', 'From 14 hero-matches.'],
      ['Healing per minute', NOT_COUNTED, 'No figures recorded.'],
      ['Blocked per minute', '310', 'From only 3 hero-matches, so treat it as a rough guide.'],
    ]);
  });

  it('shows records with the hero and date, an unknown hero as such, and the streak', () => {
    const { records } = ready();

    expect(records.map((f) => [f.label, f.value, f.detail])).toEqual([
      ['Most kills', '31', 'Hela, Oct 12, 2026'],
      ['Most assists', NOT_COUNTED, null],
      ['Most final hits', '19', 'Unknown hero, Oct 20, 2026'],
      ['Longest win streak', '4', 'Wins in a row. A match with no recorded result ends a streak.'],
    ]);
  });

  it('lists the top heroes as rows the community hero list draws', () => {
    expect(ready().topHeroes).toEqual([
      jasmine.objectContaining({ hero: 'storm', name: 'Storm', figure: '66.7%', sample: '9 matches, KDA 4.0' }),
      jasmine.objectContaining({ hero: 'hela', name: 'Hela', figure: '40.0%', sample: '5 matches' }),
    ]);
  });

  it('draws a top hero with no recorded result as not counted', () => {
    const view = ready({
      topHeroes: [{ hero: 'storm', matches: 2, wins: 0, losses: 0, winRate: null, kda: null }],
    });

    expect(view.topHeroes[0].figure).toBe(NOT_COUNTED);
  });

  it('draws a hero the roster lacks under its spelled-out id', () => {
    const view = ready({
      topHeroes: [{ hero: 'cloak-and-dagger', matches: 3, wins: 1, losses: 2, winRate: 1 / 3, kda: null }],
    });

    expect(view.topHeroes[0].name).toBe('Cloak And Dagger');
  });

  it('describes each recent match, with blanks as not counted', () => {
    const [win, loss, unknown] = ready().recent;

    expect(win).toEqual(
      jasmine.objectContaining({
        hero: 'Storm',
        result: 'Win',
        outcome: 'win',
        kda: '12 / 4 / 9',
        finalHits: '7',
        where: 'Competitive, Tokyo 2099',
      }),
    );
    expect(loss).toEqual(
      jasmine.objectContaining({ result: 'Loss', outcome: 'loss', finalHits: NOT_COUNTED, where: 'Quick Match' }),
    );
    expect(unknown).toEqual(
      jasmine.objectContaining({
        hero: 'Unknown hero',
        result: 'No result recorded',
        outcome: 'unknown',
        kda: NOT_COUNTED,
        finalHits: NOT_COUNTED,
        where: null,
      }),
    );
  });

  it('does not show a K/D/A when only some of the three were recorded', () => {
    const view = ready({ recent: [recentMatch({ deaths: null })] });

    expect(view.recent[0].kda).toBe(NOT_COUNTED);
  });

  it('keeps a recorded zero as 0', () => {
    const view = ready({ recent: [recentMatch({ kills: 0, deaths: 0, assists: 0, finalHits: 0 })] });

    expect(view.recent[0].kda).toBe('0 / 0 / 0');
    expect(view.recent[0].finalHits).toBe('0');
  });

  it('warns only when more matches existed than were read', () => {
    expect(ready().notice).toBeNull();
    expect(ready({}, true).notice).toContain('more matches than we read');
  });

  it('states the depth the stores allow', () => {
    expect(DEPTH_NOTE).toContain('about six months');
    expect(DEPTH_NOTE).toContain('another RivalsPulse user');
    expect(DEPTH_NOTE).toContain('9 October 2026');
  });

  it('survives a figure that is not a finite number', () => {
    const kda = dashboardStats().kda;
    const view = ready({ kda: kda === null ? null : { ...kda, ratio: NaN }, winRate: NaN });

    expect(figure(view.overview, 'Win rate')?.counted).toBeFalse();
    expect(figure(view.overview, 'Kills / deaths / assists')?.detail).toContain(NOT_COUNTED);
  });
});
