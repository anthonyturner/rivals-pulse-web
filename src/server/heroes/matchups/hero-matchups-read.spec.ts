import { getHeroMatchups } from './hero-matchups-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
const stats = {
  half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' }],
  totals: [{ half_season: 10.5, play_mode_id: 0, decided_matches: 100 }],
  heroes: [
    { half_season: 10.5, play_mode_id: 0, hero_id: 1011, decided_lines: 100, wins: 40,
      kills_sum: 0, kills_n: 0, deaths_sum: 0, deaths_n: 0, assists_sum: 0, assists_n: 0, final_hits_sum: 0, final_hits_n: 0 },
    { half_season: 10.5, play_mode_id: 0, hero_id: 1022, decided_lines: 100, wins: 50,
      kills_sum: 0, kills_n: 0, deaths_sum: 0, deaths_n: 0, assists_sum: 0, assists_n: 0, final_hits_sum: 0, final_hits_n: 0 },
  ],
};
const pairRows = [{
  half_season: 10.5, rank_bucket: -1, kind: 'vs', hero_id: 1011, other_hero_id: 1022,
  decided_matches: 12, decided_lines: 12, wins: 9,
}];

function answering(seen: string[]): typeof fetch {
  let pairPages = 0;

  return async (input) => {
    const url = String(input);
    const functionName = url.split('/rpc/')[1];
    seen.push(functionName);
    const body = functionName === 'read_hero_stats' ? stats : pairPages++ === 0 ? pairRows : [];

    return new Response(JSON.stringify(body), { status: 200 });
  };
}

describe('getHeroMatchups', () => {
  it('derives the website response from the same read_hero_pairs source used by Pulse Atlas', async () => {
    const seen: string[] = [];
    const result = await getHeroMatchups({ env: ENV, now: () => new Date('2026-10-30T12:00:00Z'), fetch: answering(seen) });

    expect(seen.map((functionName) => functionName.split('?')[0])).toEqual(['read_hero_pairs', 'read_hero_stats', 'read_hero_pairs']);
    expect(result.status).toBe('ready');
    expect(result.matchups[0].hero).toBe('hulk');
  });
});
