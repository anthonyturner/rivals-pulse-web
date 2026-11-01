import { emptyDashboard, linkedDashboard } from './own-dashboard.fixtures';
import { parseOwnDashboard } from './own-dashboard.parse';

describe('parseOwnDashboard', () => {
  it('reads an account with no link', () => {
    expect(parseOwnDashboard({ linked: false })).toEqual({ linked: false });
  });

  it('reads a linked player with stats', () => {
    const body = linkedDashboard();

    expect(parseOwnDashboard(JSON.parse(JSON.stringify(body)))).toEqual(body);
  });

  it('reads a linked player with no matches', () => {
    const body = emptyDashboard();

    expect(parseOwnDashboard(JSON.parse(JSON.stringify(body)))).toEqual(body);
  });

  it('refuses anything that is not a dashboard answer', () => {
    for (const body of [null, undefined, 'linked', [], {}, { linked: 'yes' }, { linked: true }]) {
      expect(parseOwnDashboard(body)).withContext(JSON.stringify(body)).toBeNull();
    }
  });

  it('refuses a linked answer with a part the page reads missing or malformed', () => {
    const good = JSON.parse(JSON.stringify(linkedDashboard())) as Record<string, any>;
    const broken = (change: (body: Record<string, any>) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(good)) as Record<string, any>;
      change(copy);

      return copy;
    };

    for (const body of [
      broken((b) => delete b['player']),
      broken((b) => (b['player'].name = 7)),
      broken((b) => (b['truncated'] = 'no')),
      broken((b) => (b['stats'].matches = '20')),
      broken((b) => (b['stats'].matches = -1)),
      broken((b) => (b['stats'].winRate = 'high')),
      broken((b) => (b['stats'].topHeroes = null)),
      broken((b) => (b['stats'].topHeroes = [{ matches: 2 }])),
      broken((b) => (b['stats'].recent = [null])),
      broken((b) => (b['stats'].perMinute = null)),
      broken((b) => (b['stats'].records = {})),
      broken((b) => delete b['stats'].lastPlayedAt),
    ]) {
      expect(parseOwnDashboard(body)).withContext(JSON.stringify(body).slice(0, 80)).toBeNull();
    }
  });
});
