import {
  type CompetitiveRank,
  type HeroWinRateInsight,
  rankValue,
  SEASON_9_HERO_INSIGHTS,
  SEASON_9_ONE_TRICKS,
  SEASON_9_ROLE_LADDER,
  type WinRateMetaQuadrant,
  type WinRateReportSnapshot,
  type WinRateTrend,
} from './season-9-week-1.data';

const videoUrl = 'https://www.youtube.com/watch?v=IcHWCu1gHmg';

interface Week2Override {
  rates?: Partial<Record<CompetitiveRank, string>>;
  trend?: WinRateTrend;
  takeaway: string;
  timestamp: string;
}

const WEEK_2_OVERRIDES: Readonly<Record<string, Week2Override>> = {
  'Angela': {
    rates: { Celestial: '≈53%' },
    trend: 'Falling',
    takeaway:
      'Still above 50% at almost every rank, but her Celestial result fell from 57% to roughly 53%.',
    timestamp: '2:24',
  },
  'Captain America': {
    rates: {
      Bronze: '≈48.6%',
      Silver: '≈48.6%',
      Gold: '≈48.6%',
      Platinum: '≈50%',
    },
    trend: 'Falling',
    takeaway:
      'Bronze through Diamond declined as stronger support escapes made backline access harder.',
    timestamp: '3:06',
  },
  'Devil Dinosaur': {
    rates: { Celestial: '≈50%' },
    trend: 'Climbing',
    takeaway:
      'The largest gain came at Celestial, rising from roughly 46% to a full 50%.',
    timestamp: '4:18',
  },
  'Groot': {
    rates: { Celestial: '≈53.5%' },
    trend: 'Falling',
    takeaway:
      'His overall curve softened, driven by a Celestial drop from 58% to roughly 53–54%.',
    timestamp: '5:04',
  },
  'Magneto': {
    rates: {
      Bronze: '≈51%',
      Silver: '≈51%',
      Gold: '≈51%',
      Diamond: '≈52%',
      Grandmaster: '≈53%',
      Celestial: '≈53.5%',
    },
    trend: 'Climbing',
    takeaway:
      'The curve rises with coordination: about 51% low, 52% Diamond, 53% GM, and 53.5% Celestial.',
    timestamp: '5:42',
  },
  'Peni Parker': {
    rates: { Celestial: '≈67%' },
    trend: 'Climbing',
    takeaway:
      'The strongest hero in the report climbed another three points at Celestial, from 64% to 67%.',
    timestamp: '6:45',
  },
  'Venom': {
    rates: { Celestial: '≈51.9%' },
    trend: 'Falling',
    takeaway:
      'Low and middle ranks ticked upward, but Celestial fell sharply from roughly 56.6% to 51.9%.',
    timestamp: '7:37',
  },
  'Adam Warlock': {
    rates: {
      Bronze: '≈52%',
      Silver: '≈52%',
      Gold: '≈52%',
      Celestial: '≈51%',
    },
    trend: 'Falling',
    takeaway:
      'He dropped at nearly every rank, including roughly 53→52% low and 55→51% at Celestial.',
    timestamp: '8:08',
  },
  'Healpool': {
    rates: { Diamond: '≈42%', Grandmaster: 'Low 40s', Celestial: '≈41%' },
    trend: 'Falling',
    takeaway:
      'Already-low high-rank results lost more than two points; Diamond reached 42% and Celestial 41%.',
    timestamp: '8:58',
  },
  'Gambit': {
    rates: { Celestial: '≈50%' },
    trend: 'Volatile',
    takeaway:
      'Most ranks improved, but Celestial unexpectedly lost almost seven points and landed near 50%.',
    timestamp: '9:39',
  },
  'Jeff the Land Shark': {
    rates: {
      Bronze: '≈43%',
      Silver: '≈43%',
      Gold: '≈43%',
      Platinum: '≈43%',
      Diamond: '≈43%',
      Grandmaster: '≈47%',
    },
    trend: 'Falling',
    takeaway:
      'Nearly every rank lost about two points: through Diamond settled near 43% and GM near 47%.',
    timestamp: '10:36',
  },
  'Jubilee': {
    rates: { Bronze: '≈49%', Silver: '≈49%', Gold: '≈49%' },
    trend: 'Climbing',
    takeaway:
      'Players learning the new kit lifted most ranks by two to three points, with low ranks near 49%.',
    timestamp: '11:32',
  },
  'Mantis': {
    rates: { Diamond: '≈61%', Celestial: '≈65%' },
    trend: 'Falling',
    takeaway:
      'She slipped slightly—about 63→61% Diamond and 66→65% Celestial—but remains exceptional.',
    timestamp: '12:16',
  },
  'Rocket Raccoon': {
    rates: {
      Bronze: '≈56%',
      Silver: '≈56%',
      Gold: '≈56%',
      Platinum: '≈56%',
      Diamond: '≈56%',
      Grandmaster: '≈56%',
      Celestial: '≈56%',
    },
    trend: 'Stable',
    takeaway:
      'A small low-rank dip aside, Rocket held near 56% and remains the report’s consistency benchmark.',
    timestamp: '13:03',
  },
  'Ultron': {
    rates: { Diamond: '≈55%', Celestial: '≈51.6%' },
    trend: 'Falling',
    takeaway:
      'Reliable below the top rank, but Diamond fell to 55% and Celestial dropped to 51.6%.',
    timestamp: '13:43',
  },
  'Black Cat': {
    rates: {
      Bronze: '≈50%',
      Silver: '≈50%',
      Gold: '≈50%',
      Celestial: '≈58%',
    },
    trend: 'Falling',
    takeaway:
      'Low and middle ranks fell toward 50%, while established Celestial players held around 58%.',
    timestamp: '14:33',
  },
  'Black Panther': {
    rates: { Celestial: '≈47.5%' },
    trend: 'Volatile',
    takeaway:
      'Lower ranks improved slightly, but Celestial remained a losing environment at roughly 47.5%.',
    timestamp: '15:08',
  },
  'Black Widow': {
    rates: {
      Bronze: '≈48%',
      Silver: '≈48%',
      Gold: '≈48%',
      Diamond: '≈47%',
    },
    trend: 'Climbing',
    takeaway:
      'The Week 2 winner gained more than three points broadly: low ranks neared 48% and Diamond 47%.',
    timestamp: '16:09',
  },
  'Cyclops': {
    rates: {
      Bronze: '≈45.5%',
      Silver: '≈45.5%',
      Gold: '≈45.5%',
      Platinum: '≈45%',
    },
    trend: 'Climbing',
    takeaway:
      'Bronze through Platinum gained one to two points while GM and Celestial largely plateaued.',
    timestamp: '17:08',
  },
  'Hela': {
    rates: {
      Bronze: '≈52%',
      Silver: '≈52%',
      Gold: '≈52%',
      Platinum: '≈52%',
      Diamond: '≈52%',
      Grandmaster: '≈52%',
      Celestial: '≈52%',
    },
    trend: 'Stable',
    takeaway:
      'She softened slightly but remained a safe investment at roughly 52% through most of the ladder.',
    timestamp: '17:53',
  },
  'Human Torch': {
    rates: { Celestial: '≈50%' },
    trend: 'Falling',
    takeaway:
      'Most ranks held steady, but Celestial lost more than five points and landed near 50%.',
    timestamp: '18:19',
  },
  'Iron Man': {
    rates: { Celestial: '≈42%' },
    trend: 'Falling',
    takeaway:
      'Results declined across the ladder and his existing Celestial cliff deepened to roughly 42%.',
    timestamp: '19:01',
  },
  'Magik': {
    rates: {
      Gold: '≈56%',
      Platinum: '≈58%',
      Diamond: '≈58%',
      Grandmaster: '≈56%',
      Celestial: '≈54%',
    },
    trend: 'Stable',
    takeaway:
      'Her stated 56→58→58→56→54 high-ladder line remains one of the most consistent DPS curves.',
    timestamp: '19:27',
  },
  'Psylocke': {
    rates: { Platinum: '≈50%', Diamond: '≈50%', Grandmaster: '≈51%' },
    trend: 'Falling',
    takeaway:
      'The report’s largest collapse: Platinum and Diamond fell near 50%, while GM fell to about 51%.',
    timestamp: '20:20',
  },
  'Scarlet Witch': {
    rates: { Celestial: '≈31.6%' },
    trend: 'Falling',
    takeaway:
      'Her Celestial win rate fell to 31.6%, the lowest single rank value highlighted in the report.',
    timestamp: '21:18',
  },
  'Squirrel Girl': {
    rates: { Celestial: '≈38%' },
    trend: 'Climbing',
    takeaway:
      'Celestial improved from roughly 30% to 38%, though the result remains far below a winning rate.',
    timestamp: '22:13',
  },
  'Storm': {
    rates: {
      Bronze: '55–57%',
      Silver: '55–57%',
      Gold: '55–57%',
      Platinum: '55–57%',
      Diamond: '55–57%',
      Grandmaster: '55–57%',
      Celestial: '≈49.5%',
    },
    trend: 'Falling',
    takeaway:
      'Storm held 55–57% through most of the ladder, then dropped to roughly 49.5% at Celestial.',
    timestamp: '23:15',
  },
};

function timestampUrl(timestamp: string): string {
  const [minutes, seconds] = timestamp.split(':').map(Number);

  return `${videoUrl}&t=${minutes * 60 + seconds}s`;
}

function week2Insight(insight: HeroWinRateInsight): HeroWinRateInsight {
  const override = WEEK_2_OVERRIDES[insight.displayName];

  if (!override) {
    return {
      ...insight,
      takeaway: `Week 2 remained close to Week 1. ${insight.takeaway}`,
      videoUrl: timestampUrl('1:19'),
      timestamp: '1:19',
    };
  }

  return {
    ...insight,
    rankWinRates: insight.rankWinRates.map((rank) =>
      override.rates?.[rank.rank] ? rankValue(rank.rank, override.rates[rank.rank]!) : rank,
    ),
    trend: override.trend ?? insight.trend,
    takeaway: override.takeaway,
    videoUrl: timestampUrl(override.timestamp),
    timestamp: override.timestamp,
  };
}

const quadrantMoves: Readonly<Record<WinRateMetaQuadrant['id'], readonly string[]>> = {
  oppressive: ['Iron Fist'],
  sleepers: ['Peni Parker'],
  traps: ['Elsa Bloodstone'],
  dead: ['Psylocke', 'Captain America', 'Rogue'],
};

export const SEASON_9_WEEK_2_REPORT: WinRateReportSnapshot = {
  season: 9,
  week: 2,
  title: 'What changed across the hero win-rate curves',
  description:
    'A transcript-built Week 2 companion showing the stated movement for every discussed hero, the updated meta-map movers, and ordered rank bands from Bronze through Celestial.',
  sourceLabel: 'New Meta Report · S9 Week 2',
  sourceUrl: videoUrl,
  videoId: 'IcHWCu1gHmg',
  duration: '36:20',
  methodology:
    'Values are approximate percentages stated in the Week 2 captions. Unchanged heroes retain the Week 1 snapshot, changed ranks use the Week 2 narration, and ranks without a stated value remain marked unavailable.',
  callouts: [
    {
      label: 'Ladder ruler',
      value: 'Peni Parker',
      description:
        'The video reports another Celestial gain, reinforcing her as the clearest all-ladder outlier.',
    },
    {
      label: 'Misused ban',
      value: 'Gambit',
      description:
        'The report questions his heavy ban rate when the highlighted Celestial win rate sits near 50%.',
    },
    {
      label: 'Biggest rebound',
      value: 'Black Widow',
      description:
        'Her rework produced one of the broadest Week 2 gains, especially through the lower ranks.',
    },
    {
      label: 'Read carefully',
      value: 'Celestial',
      description:
        'Top-rank samples move sharply, so sudden spikes and cliffs are signals to investigate.',
    },
  ],
  actions: [
    {
      title: 'Match the pick to your rank.',
      description:
        'A hero that farms Gold can fall sharply once coordinated teams punish the same approach.',
    },
    {
      title: 'Do not copy bans blindly.',
      description:
        'Compare ban pressure with actual wins; popularity and fear are not proof of ladder value.',
    },
    {
      title: 'Treat small samples as signals.',
      description:
        'Celestial spikes and cliffs deserve investigation, not automatic tier-list conclusions.',
    },
  ],
  heroInsights: SEASON_9_HERO_INSIGHTS.map(week2Insight),
  metaQuadrants: (
    [
      {
        id: 'oppressive',
        label: 'Oppressive mover',
        definition: 'High pick rate · High win rate',
        note: 'Iron Fist crossed the median line while holding near a 51% overall win rate.',
      },
      {
        id: 'sleepers',
        label: 'Sleeper mover',
        definition: 'Low pick rate · High win rate',
        note: 'Peni moved boxes because pick rate dipped—not because her dominant win rate weakened.',
      },
      {
        id: 'traps',
        label: 'Trap mover',
        definition: 'High pick rate · Low win rate',
        note: 'Elsa gained popularity while remaining just under a winning overall rate.',
      },
      {
        id: 'dead',
        label: 'Graveyard movers',
        definition: 'Low pick rate · Low win rate',
        note: 'Psylocke, Captain America, and Rogue all moved into the low-pick, low-win quadrant.',
      },
    ] satisfies Omit<WinRateMetaQuadrant, 'count' | 'heroes'>[]
  ).map((quadrant) => ({
    ...quadrant,
    heroes: [...quadrantMoves[quadrant.id]],
    count: quadrantMoves[quadrant.id].length,
  })),
  roleLadder: SEASON_9_ROLE_LADDER,
  oneTricks: SEASON_9_ONE_TRICKS,
};
