import { HERO_GAMEPLAY_ARCHETYPES } from '../../heroes/hero-gameplay-archetypes';
import type { HeroRole } from '../../heroes/hero.model';

export const COMPETITIVE_RANKS = [
  'Bronze',
  'Silver',
  'Gold',
  'Platinum',
  'Diamond',
  'Grandmaster',
  'Celestial',
] as const;

export type CompetitiveRank = (typeof COMPETITIVE_RANKS)[number];
export type WinRateTrend = 'Climbing' | 'Stable' | 'Falling' | 'Volatile';
export type WinRateCoreRole = Exclude<HeroRole, 'Multi-Role'>;

export interface RankWinRate {
  rank: CompetitiveRank;
  value: string;
  percentage: number | null;
}

export interface HeroWinRateInsight {
  heroId: string;
  displayName: string;
  role: WinRateCoreRole;
  archetype: string;
  rankWinRates: readonly RankWinRate[];
  trend: WinRateTrend;
  takeaway: string;
  imageUrl: string;
  videoUrl: string;
  timestamp: string;
}

export interface WinRateMetaQuadrant {
  id: 'oppressive' | 'sleepers' | 'traps' | 'dead';
  label: string;
  count: number;
  definition: string;
  heroes: string[];
  note: string;
}

export interface WinRateRoleLadderRow {
  rank: CompetitiveRank;
  vanguard: string;
  strategist: string;
  duelist: string;
}

export interface WinRateOneTrick {
  role: WinRateCoreRole;
  hero: string;
  heroId: string;
  reason: string;
}

export interface WinRateReportPayload {
  heroInsights: readonly HeroWinRateInsight[];
  metaQuadrants: readonly WinRateMetaQuadrant[];
  roleLadder: readonly WinRateRoleLadderRow[];
  oneTricks: readonly WinRateOneTrick[];
}

export interface WinRateReportCallout {
  label: string;
  value: string;
  description: string;
}

export interface WinRateReportAction {
  title: string;
  description: string;
}

export interface WinRateReportSnapshot extends WinRateReportPayload {
  season: number;
  week: number;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string;
  videoId: string;
  duration: string;
  methodology: string;
  callouts: readonly WinRateReportCallout[];
  actions: readonly WinRateReportAction[];
}

const videoUrl = 'https://www.youtube.com/watch?v=VB6OIA-ChmA';

function timestampUrl(timestamp: string): string {
  const [minutes, seconds] = timestamp.split(':').map(Number);

  return `${videoUrl}&t=${minutes * 60 + seconds}s`;
}

function insight(
  heroId: string,
  displayName: string,
  role: WinRateCoreRole,
  lowRanks: string,
  grandmaster: string,
  celestial: string,
  trend: WinRateTrend,
  takeaway: string,
  timestamp: string,
): HeroWinRateInsight {
  const archetype =
    HERO_GAMEPLAY_ARCHETYPES[heroId]?.find((profile) => profile.role === role)?.label ??
    'Flexible';

  return {
    heroId,
    displayName,
    role,
    archetype,
    rankWinRates: [
      rankValue('Bronze', lowRanks),
      rankValue('Silver', lowRanks),
      rankValue('Gold', lowRanks),
      rankValue('Platinum', 'Not stated'),
      rankValue('Diamond', 'Not stated'),
      rankValue('Grandmaster', grandmaster),
      rankValue('Celestial', celestial),
    ],
    trend,
    takeaway,
    imageUrl: `/images/heroes/${heroId}.png`,
    videoUrl: timestampUrl(timestamp),
    timestamp,
  };
}

export function rankValue(rank: CompetitiveRank, value: string): RankWinRate {
  const match = value.replace(',', '.').match(/(\d+(?:\.\d+)?)/);

  return {
    rank,
    value,
    percentage: match ? Number(match[1]) : null,
  };
}

export const SEASON_9_HERO_INSIGHTS: readonly HeroWinRateInsight[] = [
  insight(
    'peni-parker',
    'Peni Parker',
    'Vanguard',
    '58–65%',
    '66%',
    '64%',
    'Climbing',
    'The week-one standout. Her nests and zoning win at every level until teams consistently clear deployables.',
    '0:31',
  ),
  insight(
    'the-thing',
    'The Thing',
    'Vanguard',
    '54–56%',
    '52%',
    '50%',
    'Falling',
    'Strong into teams that fail to focus him, but increasingly punishable as coordination and aim improve.',
    '1:46',
  ),
  insight(
    'thor',
    'Thor',
    'Vanguard',
    '≈53%',
    '≈53%',
    '≈53%',
    'Stable',
    'New team-ups cover his former survivability weakness and make him unusually consistent for an off-tank.',
    '2:31',
  ),
  insight(
    'hulk',
    'Hulk',
    'Vanguard',
    '≈52%',
    '52%',
    '51%',
    'Stable',
    'A solid but complex dive option whose results do not yet match the stronger high-rank Venom curve.',
    '3:01',
  ),
  insight(
    'groot',
    'Groot',
    'Vanguard',
    '50–53%',
    '≈53%',
    '58%',
    'Climbing',
    'Wall placement, zoning, and coordinated ultimate follow-up create a major high-rank payoff.',
    '3:53',
  ),
  insight(
    'angela',
    'Angela',
    'Vanguard',
    '50–53%',
    'Not stated',
    '57%',
    'Climbing',
    'Displacement and anti-flank value grow when teammates recognize and finish the targets she isolates.',
    '4:51',
  ),
  insight(
    'magneto',
    'Magneto',
    'Vanguard',
    '50–52%',
    '50–52%',
    '50–52%',
    'Stable',
    'A dependable comfort pick, though bubbles often save poorly positioned teammates without changing the fight.',
    '6:20',
  ),
  insight(
    'venom',
    'Venom',
    'Vanguard',
    '50%',
    '53%',
    '57%',
    'Climbing',
    'Timing, target priority, cooldown tracking, and planned escape geometry separate high-rank Venom play.',
    '7:26',
  ),
  insight(
    'captain-america',
    'Captain America',
    'Vanguard',
    '49–52%',
    '50%',
    '50%',
    'Stable',
    'His peel and support-style ultimate may produce less obvious ladder impact than a more violent dive tank.',
    '8:49',
  ),
  insight(
    'devil-dinosaur',
    'Devil Dinosaur',
    'Vanguard',
    '47–50%',
    'Not stated',
    '46%',
    'Falling',
    'A large frontline target who can drain team healing while players search for a post-nerf playstyle.',
    '9:47',
  ),
  insight(
    'rogue',
    'Rogue',
    'Vanguard',
    '45–49%',
    '51%',
    '52%',
    'Climbing',
    'Ability tracking, ultimate timing, and a deep problem-solving kit reward more deliberate pilots.',
    '10:46',
  ),
  insight(
    'emma-frost',
    'Emma Frost',
    'Vanguard',
    'Below 50%',
    'Below 50%',
    'Below 50%',
    'Stable',
    'Her poor week-one numbers may reflect teams asking an anchor tank to hold alone without a partner.',
    '11:48',
  ),
  insight(
    'doctor-strange',
    'Doctor Strange',
    'Vanguard',
    '46–48%',
    'Not stated',
    '45%',
    'Falling',
    'The results conflict with his apparent kit strength; portal-only usage may be one source of noise.',
    '12:39',
  ),
  insight(
    'deadpool',
    'Tankpool',
    'Vanguard',
    '42–46%',
    'Improves',
    'Improves',
    'Climbing',
    'Deaths reset ultimate momentum, so survival, upgrade knowledge, and team follow-up are essential.',
    '13:36',
  ),
  insight(
    'mantis',
    'Mantis',
    'Strategist',
    '59–63%',
    '63%',
    '66%',
    'Climbing',
    'The strongest support curve: burst and area healing, boosts, and real headshot damage all scale upward.',
    '14:40',
  ),
  insight(
    'ultron',
    'Ultron',
    'Strategist',
    '58–61%',
    '56%',
    '57%',
    'Stable',
    'A premier low-rank climber whose aerial freedom becomes more punishable but remains effective up top.',
    '15:39',
  ),
  insight(
    'rocket-raccoon',
    'Rocket Raccoon',
    'Strategist',
    '56–58%',
    '57%',
    '55%',
    'Stable',
    'The safest main healer and one of the most reliable one-trick commitments in the roster.',
    '16:22',
  ),
  insight(
    'adam-warlock',
    'Adam Warlock',
    'Strategist',
    '50–58%',
    '≈50%',
    '55%',
    'Volatile',
    'His burst and resurrection spike when the composition is intentionally built around them.',
    '17:09',
  ),
  insight(
    'loki',
    'Loki',
    'Strategist',
    '49–53%',
    '55%',
    '57%',
    'Climbing',
    'Purposeful clones, lamp use, and flexible decision-making steadily improve with player skill.',
    '17:46',
  ),
  insight(
    'cloak-and-dagger',
    'Cloak & Dagger',
    'Strategist',
    '48–50%',
    '46%',
    '43%',
    'Falling',
    'A highly popular comfort pick whose forgiving patterns are exposed by better opponents.',
    '18:33',
  ),
  insight(
    'invisible-woman',
    'Invisible Woman',
    'Strategist',
    '46–47%',
    '48%',
    '46%',
    'Stable',
    'Reliable primary healing without a dramatic skill-floor rescue or high-ceiling payoff.',
    '19:12',
  ),
  insight(
    'white-fox',
    'White Fox',
    'Strategist',
    '46–47%',
    '43%',
    '42%',
    'Falling',
    'Her weaknesses become increasingly exploitable once opponents coordinate their pressure.',
    '19:53',
  ),
  insight(
    'jeff-the-land-shark',
    'Jeff the Land Shark',
    'Strategist',
    '44–49%',
    '49%',
    '46%',
    'Volatile',
    'Ultimate value and general decision quality vary enough to keep his results middling.',
    '20:44',
  ),
  insight(
    'gambit',
    'Gambit',
    'Strategist',
    '45–48%',
    '51%',
    '57%',
    'Climbing',
    'One of the largest climbs: synchronized teams turn his ultimate into a powerful push window.',
    '21:21',
  ),
  insight(
    'jubilee',
    'Jubilee',
    'Strategist',
    '45–47%',
    '45–47%',
    '45–47%',
    'Stable',
    'A week-one baseline for a brand-new hero; players were still learning the kit and visual language.',
    '22:45',
  ),
  insight(
    'luna-snow',
    'Luna Snow',
    'Strategist',
    '45–47%',
    '47%',
    '46%',
    'Stable',
    'Self-cleanse remains valuable, but she was neither the answer nor a disaster at any measured rank.',
    '23:35',
  ),
  insight(
    'deadpool',
    'Healpool',
    'Strategist',
    'Mid-40s',
    'Not stated',
    '41%',
    'Falling',
    'A deep kit cannot compensate for poor uptime; staying alive is the first requirement.',
    '24:06',
  ),
  insight(
    'storm',
    'Storm',
    'Duelist',
    '56–58%',
    '55%',
    '54%',
    'Falling',
    'Still strong everywhere, with especially easy value when lower-rank players fail to contest aerial angles.',
    '24:37',
  ),
  insight(
    'magik',
    'Magik',
    'Duelist',
    '54–58%',
    '55%',
    '57%',
    'Stable',
    'The most consistent DPS and a strong one-trick because she can alternate between brawl and dive.',
    '25:09',
  ),
  insight(
    'iron-man',
    'Iron Man',
    'Duelist',
    '52–56%',
    '54%',
    '44%',
    'Falling',
    'Strong until a dramatic Celestial cliff, where coordinated teams can focus a flyer quickly.',
    '26:05',
  ),
  insight(
    'psylocke',
    'Psylocke',
    'Duelist',
    '51–56%',
    '57%',
    '54%',
    'Climbing',
    'A pure flanker whose poke, ultimate economy, and timing peak around Grandmaster.',
    '27:33',
  ),
  insight(
    'mister-fantastic',
    'Mister Fantastic',
    'Duelist',
    '51–57%',
    '49%',
    '54%',
    'Volatile',
    'A brawler with a jagged curve whose results depend heavily on the lobby and team follow-up.',
    '28:25',
  ),
  insight(
    'daredevil',
    'Daredevil',
    'Duelist',
    '50–54%',
    'Not stated',
    '57%',
    'Climbing',
    'Pure dive rewards mechanics and timing, creating a clear rise as pilots improve.',
    '29:22',
  ),
  insight(
    'black-cat',
    'Black Cat',
    'Duelist',
    '49–55%',
    '56%',
    '59%',
    'Climbing',
    'One of the biggest skill curves in the game and a top-end assassin when target choices are precise.',
    '30:01',
  ),
  insight(
    'iron-fist',
    'Iron Fist',
    'Duelist',
    '51–54%',
    '51%',
    '52%',
    'Stable',
    'A steady brawler with no dramatic rank-specific failure or spike.',
    '30:44',
  ),
  insight(
    'hela',
    'Hela',
    'Duelist',
    '≈50%',
    '52%',
    '54%',
    'Climbing',
    'Precision and positioning give this hitscan pick a modest upward curve.',
    '31:28',
  ),
  insight(
    'black-panther',
    'Black Panther',
    'Duelist',
    '51–56%',
    '50%',
    '46%',
    'Falling',
    'Dominates teams that cannot track his path, then drops once coordinated opponents punish the dive.',
    '32:12',
  ),
  insight(
    'human-torch',
    'Human Torch',
    'Duelist',
    '50–55%',
    '53%',
    '56%',
    'Climbing',
    'A sleeper flyer whose area pressure improves as players and teammates use it more purposefully.',
    '33:04',
  ),
  insight(
    'blade',
    'Blade',
    'Duelist',
    'Mid-50s',
    '49%',
    '46%',
    'Falling',
    'Punishes isolated low-rank targets but struggles when teams deny his close-range approach.',
    '33:42',
  ),
  insight(
    'spider-man',
    'Spider-Man',
    'Duelist',
    '48–52%',
    '50%',
    '51%',
    'Stable',
    'A surprisingly ordinary curve, possibly because stronger supports and other dive choices limit his payoff.',
    '34:32',
  ),
  insight(
    'star-lord',
    'Star-Lord',
    'Duelist',
    '46–50%',
    '51%',
    '53%',
    'Climbing',
    'Peripheral poke, distraction, and ultimate value improve as lobbies create better openings.',
    '35:13',
  ),
  insight(
    'winter-soldier',
    'Winter Soldier',
    'Duelist',
    '48–51%',
    '47%',
    '44%',
    'Falling',
    'Limited mobility makes every positioning error easier to isolate and punish at high rank.',
    '35:43',
  ),
  insight(
    'hawkeye',
    'Hawkeye',
    'Duelist',
    '47–52%',
    '51%',
    '48%',
    'Volatile',
    'A mechanically gated poke specialist whose strongest pilots remain outliers and whose weaknesses are targetable.',
    '36:26',
  ),
  insight(
    'elsa-bloodstone',
    'Elsa Bloodstone',
    'Duelist',
    '47–51%',
    '50%',
    '50%',
    'Stable',
    'A flexible utility DPS who peels, zones, and answers dives without specializing enough to spike.',
    '37:16',
  ),
  insight(
    'namor',
    'Namor',
    'Duelist',
    '48–50%',
    '47%',
    '43%',
    'Falling',
    'Deployable zoning loses value when higher-rank teams simply clear the squids.',
    '37:54',
  ),
  insight(
    'the-punisher',
    'The Punisher',
    'Duelist',
    '≈48%',
    '≈48%',
    '≈48%',
    'Stable',
    'Straightforward angle-holding and sustained damage make him reliable but replaceable.',
    '38:45',
  ),
  insight(
    'wolverine',
    'Wolverine',
    'Duelist',
    'Low-to-high 40s',
    '46%',
    '49%',
    'Climbing',
    'A situational tank buster who needs tanks to hunt, team follow-up, and focused healing during the commit.',
    '39:32',
  ),
  insight(
    'scarlet-witch',
    'Scarlet Witch',
    'Duelist',
    '45–47%',
    '40%',
    '37%',
    'Falling',
    'Forgiving tracking damage stops carrying once opponents punish her limited play patterns and telegraphed ultimate.',
    '40:22',
  ),
  insight(
    'deadpool',
    'DPSpool',
    'Duelist',
    '43–46%',
    '47%',
    '45%',
    'Stable',
    'Staying alive, choosing upgrades deliberately, and using the ultimate purposefully remain the core requirements.',
    '41:12',
  ),
  insight(
    'black-widow',
    'Black Widow',
    'Duelist',
    '43–45%',
    '45%',
    '48%',
    'Climbing',
    'The rework shows early promise, with her ranged threat becoming more credible as skill rises.',
    '41:44',
  ),
  insight(
    'squirrel-girl',
    'Squirrel Girl',
    'Duelist',
    'Mid-40s',
    '38%',
    '31%',
    'Falling',
    'The roster’s worst top-end number: clever zoning remains possible, but coordinated dives shut her down.',
    '42:44',
  ),
  insight(
    'cyclops',
    'Cyclops',
    'Duelist',
    '43–45%',
    '42%',
    '43%',
    'Stable',
    'A seemingly strong new hero whose week-one players had not yet converted kit power into wins.',
    '43:45',
  ),
  insight(
    'phoenix',
    'Phoenix',
    'Duelist',
    'Low 40s',
    'Low 40s',
    'Low 40s',
    'Stable',
    'Her oppressive-feeling ranged pressure did not translate into a winning curve during this snapshot.',
    '44:21',
  ),
  insight(
    'moon-knight',
    'Moon Knight',
    'Duelist',
    'Mid-40s',
    '38%',
    '33%',
    'Falling',
    'Area damage without enough final blows collapses when high-rank teams deny ankhs and punish flanks.',
    '44:55',
  ),
];

export const SEASON_9_META_QUADRANTS: readonly WinRateMetaQuadrant[] = [
  {
    id: 'oppressive',
    label: 'Oppressive',
    count: 11,
    definition: 'High pick rate · High win rate',
    heroes: [
      'Rocket Raccoon',
      'Magneto',
      'Mantis',
      'Peni Parker',
      'The Thing',
      'Thor',
      'Hulk',
      'Hela',
      'Black Panther',
      'Magik',
      'Venom',
    ],
    note: 'Everyone plays them and they still win—the combination most likely to attract nerfs.',
  },
  {
    id: 'sleepers',
    label: 'Sleepers',
    count: 15,
    definition: 'Low pick rate · High win rate',
    heroes: ['Ultron', 'Storm', 'Iron Man', 'Psylocke', 'Groot', 'Black Cat', 'Daredevil'],
    note: 'The video names these seven examples from a 15-hero box as the best place to look for “free ELO.”',
  },
  {
    id: 'traps',
    label: 'Traps',
    count: 17,
    definition: 'High pick rate · Low win rate',
    heroes: [
      'Cloak & Dagger',
      'White Fox',
      'Invisible Woman',
      'Doctor Strange',
      'Emma Frost',
      'Luna Snow',
    ],
    note: 'Popular picks whose results fail to match how often players lock them.',
  },
  {
    id: 'dead',
    label: 'Dead',
    count: 11,
    definition: 'Low pick rate · Low win rate',
    heroes: [
      'Moon Knight',
      'Squirrel Girl',
      'Phoenix',
      'Tankpool',
      'Healpool',
      'DPSpool',
      'Scarlet Witch',
      'Wolverine',
    ],
    note: 'The transcript names these eight variants from the 11-member week-one graveyard.',
  },
];

export const SEASON_9_ROLE_LADDER: readonly WinRateRoleLadderRow[] = [
  { rank: 'Bronze', vanguard: '≈50%', strategist: '≈50%', duelist: '≈48%' },
  { rank: 'Silver', vanguard: 'Bunched', strategist: 'Slight lead', duelist: 'Bunched' },
  { rank: 'Gold', vanguard: '≈51%', strategist: 'Middle', duelist: '≈49.9%' },
  { rank: 'Diamond', vanguard: 'Nearly 52%', strategist: 'Middle', duelist: 'Falling' },
  { rank: 'Celestial', vanguard: '≈52%', strategist: 'Middle', duelist: '≈48%' },
] as const;

export const SEASON_9_ONE_TRICKS: readonly WinRateOneTrick[] = [
  {
    role: 'Vanguard',
    hero: 'Peni Parker',
    heroId: 'peni-parker',
    reason: 'Repeatable nest placement, zoning knowledge, and elite week-one results.',
  },
  {
    role: 'Duelist',
    hero: 'Magik',
    heroId: 'magik',
    reason: 'Consistent results plus the flexibility to frontline or dive.',
  },
  {
    role: 'Strategist',
    hero: 'Rocket Raccoon',
    heroId: 'rocket-raccoon',
    reason: 'The safest support curve across ranks and compositions.',
  },
] as const;

export const SEASON_9_WEEK_1_REPORT: WinRateReportSnapshot = {
  season: 9,
  week: 1,
  title: 'What the win-rate curves say about every hero',
  description:
    'Approximate rank-by-rank results, the pick-rate meta map, role performance, one-trick recommendations, and a gameplay archetype for every hero.',
  sourceLabel: 'Every Hero’s Win Rate · S9 Week 1',
  sourceUrl: videoUrl,
  videoId: 'VB6OIA-ChmA',
  duration: '55:45',
  methodology:
    'Rates are approximate values spoken or shown in the Season 9 Week 1 video. Repeated low-rank bands are shown across Bronze through Gold; ranks the video did not state are marked unavailable.',
  callouts: [
    {
      label: 'Best climb role',
      value: 'Vanguard',
      description:
        'Tanks lead average win rate from Gold onward and reach roughly 52% at Celestial.',
    },
    {
      label: 'Best composition',
      value: '2 · 2 · 2',
      description:
        'Two tanks, two DPS, and two supports remain the most played and highest-winning setup.',
    },
    {
      label: 'Best opportunity',
      value: 'Sleepers',
      description:
        'Low-pick, high-win heroes offer strong value before the wider ladder catches on.',
    },
    {
      label: 'Core lesson',
      value: 'Stay alive',
      description:
        'Uptime, deployable clearing, and coordinated follow-up explain many of the sharpest curves.',
    },
  ],
  actions: [
    {
      title: 'Look in the sleeper box.',
      description:
        'Ultron, Storm, and other low-pick winners offer value without fighting over the fashionable lock.',
    },
    {
      title: 'One-trick consistency, not hype.',
      description:
        'Choose a repeatable hero, learn every angle and cooldown, and let familiarity compound.',
    },
    {
      title: 'Run two tanks and clear deployables.',
      description:
        'Complementary tank jobs and basic nest or turret discipline solve a surprising amount below Diamond.',
    },
  ],
  heroInsights: SEASON_9_HERO_INSIGHTS,
  metaQuadrants: SEASON_9_META_QUADRANTS,
  roleLadder: SEASON_9_ROLE_LADDER,
  oneTricks: SEASON_9_ONE_TRICKS,
};
