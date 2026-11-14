import type { Hero, HeroGameplayArchetype, HeroRole } from './hero.model';

const videoId = 'VB6OIA-ChmA';
const sourceTitle = "Nerfpool: Every Hero's Win Rate (Season 9, Week 1)";

function archetype(
  role: HeroRole,
  label: string,
  description: string,
  timestamp: string,
): HeroGameplayArchetype {
  const [minutes, seconds] = timestamp.split(':').map(Number);
  const start = minutes * 60 + seconds;

  return {
    role,
    label,
    description,
    sourceTitle,
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}&t=${start}s`,
    timestamp,
  };
}

/**
 * Editorial archetypes translated from the fight jobs described in Nerfpool's
 * Season 9 Week 1 analysis. Labels such as off-tank, anchor, flyer, and flexible
 * are gameplay jobs, not official Marvel Rivals role names.
 */
export const HERO_GAMEPLAY_ARCHETYPES: Readonly<Record<string, HeroGameplayArchetype[]>> = {
  'peni-parker': [
    archetype(
      'Vanguard',
      'Zone Tank',
      'Controls space through nests and deployables; her value drops quickly when opponents clear that setup.',
      '0:31',
    ),
  ],
  'the-thing': [
    archetype(
      'Vanguard',
      'Brawl Tank',
      'A durable frontline bruiser who punishes lower-rank teams but becomes easier to focus and punish higher up.',
      '1:46',
    ),
  ],
  thor: [
    archetype(
      'Vanguard',
      'Off-Tank',
      'Adds pressure and survivability beside an anchor instead of relying on a shield to hold the entire line.',
      '2:31',
    ),
  ],
  hulk: [
    archetype(
      'Vanguard',
      'Dive Tank',
      'A mechanically demanding initiator whose engage timing and target selection matter more than raw durability.',
      '3:01',
    ),
  ],
  groot: [
    archetype(
      'Vanguard',
      'Anchor Tank',
      'Holds and reshapes space with walls, zoning, and team-assisted ultimate setups.',
      '3:53',
    ),
  ],
  angela: [
    archetype(
      'Vanguard',
      'Off-Tank',
      'A hyper-mobile disruptor who displaces tanks, shuts down flankers, and creates picks for teammates.',
      '4:51',
    ),
  ],
  magneto: [
    archetype(
      'Vanguard',
      'Off-Tank',
      'Supports an anchor with bubbles, ranged pressure, and a fight-swinging ultimate rather than solo mobility.',
      '6:20',
    ),
  ],
  venom: [
    archetype(
      'Vanguard',
      'Dive Tank',
      'Creates backline pressure through timed engages, target focus, and planned wall or slam escape routes.',
      '7:26',
    ),
  ],
  'captain-america': [
    archetype(
      'Vanguard',
      'Peel Tank',
      'Mixes dive pressure with backline peel and a support-oriented ultimate.',
      '8:49',
    ),
  ],
  'devil-dinosaur': [
    archetype(
      'Vanguard',
      'Main Tank',
      'A bulky frontline body that absorbs attention but can consume too many healing resources when exposed.',
      '9:47',
    ),
  ],
  rogue: [
    archetype(
      'Vanguard',
      'Flexible Tank',
      'Solves different fight problems through ability tracking, timing, and purposeful adaptation.',
      '10:46',
    ),
  ],
  'emma-frost': [
    archetype(
      'Vanguard',
      'Anchor Tank',
      'Holds the team structure from the front and performs best with a second tank supporting her.',
      '11:48',
    ),
  ],
  'doctor-strange': [
    archetype(
      'Vanguard',
      'Anchor Tank',
      'A shield-based main tank who holds lanes, enables crossings, and pairs naturally with an off-tank.',
      '12:39',
    ),
  ],
  deadpool: [
    archetype(
      'Vanguard',
      'Flexible Tank',
      'Tankpool converts upgrades and survival into disruption, but loses much of his value when deaths reset momentum.',
      '13:36',
    ),
    archetype(
      'Strategist',
      'Flexible Healer',
      'Healpool needs disciplined uptime and deliberate upgrade choices to turn a nuanced kit into sustained value.',
      '24:06',
    ),
    archetype(
      'Duelist',
      'Flexible DPS',
      'DPSpool depends on staying alive, choosing upgrades deliberately, and using the ultimate with a clear purpose.',
      '41:12',
    ),
  ],
  mantis: [
    archetype(
      'Strategist',
      'Flex Support',
      'Combines burst and area healing with damage, headshot pressure, and ally damage boosts.',
      '14:40',
    ),
  ],
  ultron: [
    archetype(
      'Strategist',
      'Flyer',
      'Uses aerial angles to add healing and damage, with positioning becoming more punishable at higher ranks.',
      '15:39',
    ),
  ],
  'rocket-raccoon': [
    archetype(
      'Strategist',
      'Main Healer',
      'A consistent primary healer who supports diverse teams and rewards reliable execution at every rank.',
      '16:22',
    ),
  ],
  'adam-warlock': [
    archetype(
      'Strategist',
      'Burst Healer',
      'Excels when a composition is built around his burst sustain and resurrection timing.',
      '17:09',
    ),
  ],
  loki: [
    archetype(
      'Strategist',
      'Flexible Healer',
      'Adapts through deliberate clone placement, lamp timing, damage, and copied ultimates.',
      '17:46',
    ),
  ],
  'cloak-and-dagger': [
    archetype(
      'Strategist',
      'Main Healer',
      'Offers forgiving sustain and utility, though predictable comfort play becomes punishable at higher ranks.',
      '18:33',
    ),
  ],
  'invisible-woman': [
    archetype(
      'Strategist',
      'Main Healer',
      'Provides reliable primary sustain and utility without depending on a narrow specialist setup.',
      '19:12',
    ),
  ],
  'white-fox': [
    archetype(
      'Strategist',
      'Main Healer',
      'Supplies primary healing but has exploitable weaknesses that become clearer in coordinated lobbies.',
      '19:53',
    ),
  ],
  'jeff-the-land-shark': [
    archetype(
      'Strategist',
      'Main Healer',
      'Sustains grouped teams and looks for high-impact ultimate windows, with results tied heavily to decision quality.',
      '20:44',
    ),
  ],
  gambit: [
    archetype(
      'Strategist',
      'Tempo Support',
      'Enables synchronized team pushes and uses his ultimate to create an aggressive window for the whole team.',
      '21:21',
    ),
  ],
  jubilee: [
    {
      role: 'Strategist',
      label: 'Brawl Tempo Healer',
      description:
        'Leapfrogs charged healing zones with a grouped frontline, then chains detonations and Sparkle Marks to maintain enhanced healing and damage.',
      sourceTitle: 'The ULTIMATE ADVANCED Jubilee Guide in Marvel Rivals',
      sourceUrl: 'https://www.youtube.com/watch?v=-XnynKZDHls&t=1453s',
      timestamp: '24:13',
    },
  ],
  'luna-snow': [
    archetype(
      'Strategist',
      'Main Healer',
      'A steady primary healer with self-cleanse utility and few extreme rank-dependent swings.',
      '23:35',
    ),
  ],
  storm: [
    archetype(
      'Duelist',
      'Flyer',
      'Controls aerial sightlines and farms teams that fail to look up, while remaining useful as aim improves.',
      '24:37',
    ),
  ],
  magik: [
    archetype(
      'Duelist',
      'Flexible DPS',
      'Switches between frontline brawling and backline diving according to the fight.',
      '25:09',
    ),
  ],
  'iron-man': [
    archetype(
      'Duelist',
      'Flyer',
      'Creates ranged aerial pressure but becomes fragile when top-rank teams coordinate focus.',
      '26:05',
    ),
  ],
  psylocke: [
    archetype(
      'Duelist',
      'Flanker',
      'A pure flanker who pokes, builds ultimate, and converts timing windows into backline pressure.',
      '27:33',
    ),
  ],
  'mister-fantastic': [
    archetype(
      'Duelist',
      'Brawler',
      'Thrives in extended close fights where durability and team follow-up let him keep applying pressure.',
      '28:25',
    ),
  ],
  daredevil: [
    archetype(
      'Duelist',
      'Dive DPS',
      'Rewards mechanical execution, timing, and target access with stronger results as players improve.',
      '29:22',
    ),
  ],
  'black-cat': [
    archetype(
      'Duelist',
      'Flanker',
      'A high-ceiling assassin who turns mobility and precise target selection into elite-rank wins.',
      '30:01',
    ),
  ],
  'iron-fist': [
    archetype(
      'Duelist',
      'Brawler',
      'Applies steady close-range pressure without relying on a dramatic rank-specific performance spike.',
      '30:44',
    ),
  ],
  hela: [
    archetype(
      'Duelist',
      'Hitscan',
      'Provides dependable ranged precision and becomes more valuable as aim and positioning improve.',
      '31:28',
    ),
  ],
  'black-panther': [
    archetype(
      'Duelist',
      'Dive DPS',
      'Runs through uncoordinated teams but becomes much easier to punish when opponents track his commit.',
      '32:12',
    ),
  ],
  'human-torch': [
    archetype(
      'Duelist',
      'Flyer',
      'Uses aerial mobility and area pressure as a sleeper pick that improves in coordinated play.',
      '33:04',
    ),
  ],
  blade: [
    archetype(
      'Duelist',
      'Brawler',
      'Punishes isolated targets in close range but struggles when coordinated teams deny his approach.',
      '33:42',
    ),
  ],
  'spider-man': [
    archetype(
      'Duelist',
      'Dive DPS',
      'A mobile backline diver whose performance depends on finding killable supports and clean escape timing.',
      '34:32',
    ),
  ],
  'star-lord': [
    archetype(
      'Duelist',
      'Flanker',
      'Pokes from peripheral angles, distracts the backline, and builds toward a reliable ultimate.',
      '35:13',
    ),
  ],
  'winter-soldier': [
    archetype(
      'Duelist',
      'Poke DPS',
      'Controls a ranged lane but depends heavily on positioning because limited mobility makes dives dangerous.',
      '35:43',
    ),
  ],
  hawkeye: [
    archetype(
      'Duelist',
      'Poke DPS',
      'A mechanically demanding ranged specialist who is powerful in expert hands but highly punishable.',
      '36:26',
    ),
  ],
  'elsa-bloodstone': [
    archetype(
      'Duelist',
      'Flexible DPS',
      'A do-everything utility pick who can peel, zone, and answer dives without over-specializing.',
      '37:16',
    ),
  ],
  namor: [
    archetype(
      'Duelist',
      'Zone DPS',
      'Denies areas through deployables, with value dropping when opponents clear them efficiently.',
      '37:54',
    ),
  ],
  'the-punisher': [
    archetype(
      'Duelist',
      'Poke DPS',
      'Holds straightforward firing angles and supplies sustained ranged damage from behind the tanks.',
      '38:45',
    ),
  ],
  wolverine: [
    archetype(
      'Duelist',
      'Tank Buster',
      'Displaces and shreds tanks but needs team follow-up and healing to survive the commit.',
      '39:32',
    ),
  ],
  'scarlet-witch': [
    archetype(
      'Duelist',
      'Close-Range DPS',
      'Uses forgiving tracking damage at low rank but needs creative ultimate setups when opponents punish her.',
      '40:22',
    ),
  ],
  'black-widow': [
    archetype(
      'Duelist',
      'Poke DPS',
      'A reworked ranged threat whose early Season 9 results improve as positioning and precision rise.',
      '41:44',
    ),
  ],
  'squirrel-girl': [
    archetype(
      'Duelist',
      'Zone DPS',
      'Bounces projectiles to fill lanes with pressure but is vulnerable to coordinated dives.',
      '42:44',
    ),
  ],
  cyclops: [
    archetype(
      'Duelist',
      'Hitscan',
      'Applies direct ranged pressure, though week-one players had not converted his apparent strength into wins.',
      '43:45',
    ),
  ],
  phoenix: [
    archetype(
      'Duelist',
      'Hitscan',
      'An aim-driven ranged threat whose oppressive pressure had not translated into strong week-one win rates.',
      '44:21',
    ),
  ],
  'moon-knight': [
    archetype(
      'Duelist',
      'Zone DPS',
      'Creates clustered damage and flank pressure but struggles to secure final blows against coordinated teams.',
      '44:55',
    ),
  ],
};

export function withHeroGameplayArchetypes(hero: Hero): Hero {
  const gameplayArchetypes = HERO_GAMEPLAY_ARCHETYPES[hero.id];

  return gameplayArchetypes ? { ...hero, gameplayArchetypes } : hero;
}
