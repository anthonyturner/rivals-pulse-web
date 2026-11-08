import { heroIdentities } from '../insights/hero-identity';
import { GENERIC_PROFILE_LEAD, profileLead } from './profile-lead';

const IDENTITIES = heroIdentities([
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' },
]);

describe('profileLead', () => {
  it('is the generic page art when the player has no most-played hero', () => {
    const lead = profileLead(undefined, IDENTITIES);

    expect(lead).toBe(GENERIC_PROFILE_LEAD);
    expect(lead.chip).toBeNull();
    expect(lead.imageUrl).toBe('/images/site/banners/my-stats-banner.webp');
    expect(`${lead.title} ${lead.description}`).not.toMatch(/\d/);
  });

  it('names the most-played hero, shows its portrait and states its record', () => {
    const lead = profileLead({ hero: 'storm', matches: 9, wins: 6, losses: 3, winRate: 6 / 9, kda: null }, IDENTITIES);

    expect(lead).toEqual({
      title: 'Storm',
      description: '9 matches, 66.7% win rate',
      chip: { kind: 'accent', label: 'Most played' },
      imageUrl: '/images/heroes/storm.png',
      imageFit: 'portrait',
    });
  });

  it('leaves the win rate out, rather than showing a zero, when no match has a result', () => {
    const lead = profileLead({ hero: 'storm', matches: 1, wins: 0, losses: 0, winRate: null, kda: null }, IDENTITIES);

    expect(lead.description).toBe('1 match');
  });

  it('draws a hero the roster lacks under its spelled-out id and the default portrait path', () => {
    const lead = profileLead(
      { hero: 'cloak-and-dagger', matches: 3, wins: 1, losses: 2, winRate: 1 / 3, kda: null },
      IDENTITIES,
    );

    expect(lead.title).toBe('Cloak And Dagger');
    expect(lead.imageUrl).toBe('/images/heroes/cloak-and-dagger.png');
  });
});
