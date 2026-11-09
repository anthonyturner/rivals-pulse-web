import { emptyDashboard, linkedDashboard } from '../../core/auth/own-dashboard.fixtures';
import { heroIdentities } from '../insights/hero-identity';
import { GENERIC_PROFILE_LEAD, profileLead } from './profile-lead';

const IDENTITIES = heroIdentities([
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' },
]);

describe('profileLead', () => {
  it('is the generic page art, with no hero name or figures, when nothing is known about the player', () => {
    const lead = profileLead({ status: 'signedOut' }, IDENTITIES);

    expect(lead).toBe(GENERIC_PROFILE_LEAD);
    expect(lead.chip).toBeNull();
    expect(lead.imageUrl).toBe('/images/site/banners/my-stats-banner.webp');
    expect(`${lead.title} ${lead.description}`).not.toMatch(/\d/);
  });

  it('is the generic art while the answer or the roster has not arrived, and when the stats cannot be read', () => {
    const answer = { status: 'ready', dashboard: linkedDashboard() } as const;

    expect(profileLead(undefined, IDENTITIES)).toBe(GENERIC_PROFILE_LEAD);
    expect(profileLead(answer, undefined)).toBe(GENERIC_PROFILE_LEAD);
    expect(profileLead({ status: 'unavailable' }, IDENTITIES)).toBe(GENERIC_PROFILE_LEAD);
  });

  it('is the generic art for an account with no link, and for a linked player with no matches', () => {
    expect(profileLead({ status: 'ready', dashboard: { linked: false } }, IDENTITIES)).toBe(GENERIC_PROFILE_LEAD);
    expect(profileLead({ status: 'ready', dashboard: emptyDashboard() }, IDENTITIES)).toBe(GENERIC_PROFILE_LEAD);
  });

  it('is the generic art when none of the played heroes is one the site knows', () => {
    expect(profileLead({ status: 'ready', dashboard: linkedDashboard({ topHeroes: [] }) }, IDENTITIES)).toBe(
      GENERIC_PROFILE_LEAD,
    );
  });

  it('names the most-played hero, shows its portrait and states its record', () => {
    const lead = profileLead({ status: 'ready', dashboard: linkedDashboard() }, IDENTITIES);

    expect(lead).toEqual({
      title: 'Storm',
      description: '9 matches, 66.7% win rate',
      chip: { kind: 'accent', label: 'Most played' },
      imageUrl: '/images/heroes/storm.png',
      imageFit: 'portrait',
    });
  });

  it('leaves the win rate out, rather than showing a zero, when no match has a result', () => {
    const stats = { topHeroes: [{ hero: 'storm', matches: 1, wins: 0, losses: 0, winRate: null, kda: null }] };

    expect(profileLead({ status: 'ready', dashboard: linkedDashboard(stats) }, IDENTITIES).description).toBe('1 match');
  });

  it('draws a hero the roster lacks under its spelled-out id and the default portrait path', () => {
    const stats = { topHeroes: [{ hero: 'cloak-and-dagger', matches: 3, wins: 1, losses: 2, winRate: 1 / 3, kda: null }] };
    const lead = profileLead({ status: 'ready', dashboard: linkedDashboard(stats) }, IDENTITIES);

    expect(lead.title).toBe('Cloak And Dagger');
    expect(lead.imageUrl).toBe('/images/heroes/cloak-and-dagger.png');
  });
});
