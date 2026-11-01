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

  describe('refuses a linked answer with', () => {
    type Body = Record<string, any>;
    const cases: Record<string, (body: Body) => void> = {
      'no player': (b) => delete b['player'],
      'a player name that is not text': (b) => (b['player'].name = 7),
      'an avatar that is neither text nor null': (b) => (b['player'].avatarUrl = 3),
      'a truncated flag that is not a boolean': (b) => (b['truncated'] = 'no'),
      'a match count that is text': (b) => (b['stats'].matches = '20'),
      'a negative match count': (b) => (b['stats'].matches = -1),
      'no win rate': (b) => delete b['stats'].winRate,
      'a win rate that is text': (b) => (b['stats'].winRate = 'high'),
      'a K/D/A that is not an object': (b) => (b['stats'].kda = 4),
      'a K/D/A missing its ratio': (b) => delete b['stats'].kda.ratio,
      'a K/D/A average that is not finite': (b) => (b['stats'].kda.killsPerMatch = null),
      'final hits missing its average': (b) => delete b['stats'].finalHits.perMatch,
      'final hits with a text total': (b) => (b['stats'].finalHits.total = '96'),
      'top heroes that are not a list': (b) => (b['stats'].topHeroes = null),
      'a top hero with no id': (b) => delete b['stats'].topHeroes[0].hero,
      'a top hero with no win rate': (b) => delete b['stats'].topHeroes[0].winRate,
      'a top hero with no K/D/A field': (b) => delete b['stats'].topHeroes[1].kda,
      'a top hero with a malformed K/D/A': (b) => (b['stats'].topHeroes[0].kda = { matches: 1 }),
      'no per-minute figures': (b) => delete b['stats'].perMinute,
      'an empty per-minute object': (b) => (b['stats'].perMinute = {}),
      'a per-minute rate with no sample size': (b) => delete b['stats'].perMinute.damage.samples,
      'a per-minute rate that is text': (b) => (b['stats'].perMinute.damage.perMinute = 'fast'),
      'records with no streak': (b) => delete b['stats'].records.longestWinStreak,
      'records with only a streak': (b) => (b['stats'].records = { longestWinStreak: 0 }),
      'a record with no value': (b) => delete b['stats'].records.mostKills.value,
      'a record with no date': (b) => delete b['stats'].records.mostKills.playedAt,
      'a record whose hero is missing': (b) => delete b['stats'].records.mostKills.hero,
      'a recent list holding null': (b) => (b['stats'].recent = [null]),
      'a recent match with no time': (b) => delete b['stats'].recent[0].playedAt,
      'a recent match with no hero field': (b) => delete b['stats'].recent[0].hero,
      'a recent match with an unknown result': (b) => (b['stats'].recent[0].result = 'draw'),
      'a recent match with no result field': (b) => delete b['stats'].recent[0].result,
      'a recent match with no kills field': (b) => delete b['stats'].recent[0].kills,
      'a recent match with text deaths': (b) => (b['stats'].recent[0].deaths = '4'),
      'a recent match with no assists field': (b) => delete b['stats'].recent[0].assists,
      'a recent match with no final hits field': (b) => delete b['stats'].recent[0].finalHits,
      'a recent match with no mode field': (b) => delete b['stats'].recent[0].playModeId,
      'a recent match with a numeric map': (b) => (b['stats'].recent[0].mapName = 5),
      'no first-played time': (b) => delete b['stats'].firstPlayedAt,
      'no last-played time': (b) => delete b['stats'].lastPlayedAt,
    };

    for (const [name, change] of Object.entries(cases)) {
      it(name, () => {
        const body = JSON.parse(JSON.stringify(linkedDashboard())) as Body;
        change(body);

        expect(parseOwnDashboard(body)).toBeNull();
      });
    }
  });
});
