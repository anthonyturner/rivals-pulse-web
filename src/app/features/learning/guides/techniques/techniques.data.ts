export type TechniqueCategory = 'Fundamentals' | 'Roles' | 'Mindset' | 'VOD Reviews' | 'Analyses';

export interface SourceLink {
  label: string;
  url: string;
}

export interface TechniqueGuide {
  id: string;
  category: TechniqueCategory;
  title: string;
  takeaway: string;
  practice: string;
  image: string;
  tags: string[];
  links: SourceLink[];
}

export interface FightFlowStep {
  label: string;
  note: string;
}

export interface HeroWorkshop {
  hero: string;
  role: 'Vanguard' | 'Duelist' | 'Strategist';
  image: string;
  focus: string;
  links: SourceLink[];
}

export interface RoleLibrary {
  role: string;
  heroes: string[];
}

export const TECHNIQUE_CATEGORIES: readonly TechniqueCategory[] = [
  'Fundamentals',
  'Roles',
  'Mindset',
  'VOD Reviews',
  'Analyses',
];

export const TECHNIQUE_GUIDES: readonly TechniqueGuide[] = [
  {
    id: 'cover',
    category: 'Fundamentals',
    title: 'Strategic Cover Usage',
    takeaway:
      "Make cover the starting point for pressure rather than the place you search for after losing a trade. Peek to achieve something, trade damage, then break sightlines before the enemy can give a full answer. Preparing that return makes the next attempt more repeatable.",
    practice:
      'In each fight, name your next cover piece before you spend a cooldown. If you cannot name it, rotate first and shoot second.',
    image: '/images/heroes/doctor-strange.png',
    tags: ['Cover', 'Survivability', 'Sightlines'],
    links: [
      { label: 'Guide notes', url: '/strategic-cover' },
      { label: 'Edited video', url: 'https://youtu.be/rqxP_tKV2vc?si=9K2auPgj1OXjaD2y' },
      { label: 'Full masterclass', url: 'https://www.youtube.com/watch?v=tatptJPB3EQ' },
    ],
  },
  {
    id: 'high-ground',
    category: 'Fundamentals',
    title: 'High Ground Discipline',
    takeaway:
      "Judge height by the choices it creates. A useful elevated position changes enemy pathing, protects your resources or lets you decide when the duel begins. Dropping without a fight-winning reason can give away those advantages and save the enemy the mobility they would have needed to reach you.",
    practice:
      'Before dropping, ask whether the drop wins the fight now. If not, keep the angle and make the enemy spend mobility to reach you.',
    image: '/images/heroes/iron-man.png',
    tags: ['High Ground', 'Angles', 'Map Control'],
    links: [
      { label: 'Edited video', url: 'https://youtu.be/_PdmvN0s0ew?si=E8lcu1rTkWXSU3mi' },
      {
        label: 'Article',
        url: 'https://www.reddit.com/r/RivalsCollege/comments/1nk73ex/you_are_using_high_ground_wrong_in_marvel_rivals/',
      },
    ],
  },
  {
    id: 'rotations',
    category: 'Fundamentals',
    title: 'Non-linear Rotations',
    takeaway:
      "A rotation should change the problem the enemy has to solve, not merely shorten your walk. A less obvious route can hide your timing and preserve cooldowns while creating new pressure on the backline. When an entry fails, compare the path you used with a route that avoids the main enemy angle without abandoning the objective.",
    practice:
      'After every lost fight, identify one route that would have avoided the enemy main angle while keeping pressure on the objective.',
    image: '/images/heroes/spider-man.png',
    tags: ['Rotations', 'Pathing', 'Tempo'],
    links: [{ label: 'Video', url: 'https://youtu.be/oAdjNFeiOrQ?si=ZQxCLxHa_fukSotJ' }],
  },
  {
    id: 'power-positions',
    category: 'Fundamentals',
    title: 'Power Positions',
    takeaway:
      "A useful position connects pressure with a route out. It lets you influence multiple lanes and makes enemies look away from the team while leaving a safe retreat. Choose the position for the fight you intend to play, then identify where you will reset if that plan changes.",
    practice:
      'On each map, mark one power position for poke, one for brawl staging, and one emergency reset position.',
    image: '/images/heroes/magneto.png',
    tags: ['Positioning', 'Map Control', 'Pressure'],
    links: [
      { label: 'Guide notes', url: '/power-positions' },
      { label: 'Edited video', url: 'https://youtu.be/FmfiDOyZmrQ?si=b8gXQdcpU1Y2vqfF' },
      { label: 'Full masterclass', url: 'https://youtu.be/hnCgeDZCt0I?si=d7wxsqlCxCDMWcwU' },
    ],
  },
  {
    id: 'killboxes',
    category: 'Fundamentals',
    title: 'Killboxes',
    takeaway:
      "A killbox is the space threatened by several friendly angles at once. Prepare those overlapping lines around the enemy route so a teammate can help punish the same entry. Chasing alone gives up the shared pressure the setup was meant to create.",
    practice:
      'Ping the enemy path, then hold two angles on the same doorway or corner for three seconds before committing mobility.',
    image: '/images/heroes/winter-soldier.png',
    tags: ['Focus Fire', 'Angles', 'Fight Planning'],
    links: [
      { label: 'Edited video', url: 'https://youtu.be/9bp0D7R9zbg?si=flVjnb_HF0puZU-3' },
      { label: 'Masterclass', url: 'https://youtu.be/v8M4ob20SSA?si=3lDaRnobtzpRHlhC' },
    ],
  },
  {
    id: 'lane-control',
    category: 'Fundamentals',
    title: 'Lane Control and Uptime',
    takeaway:
      "Lane control changes where the enemy can safely stand. Keep useful pressure on that space without exposing yourself so far that the position becomes unsustainable. Uptime is time spent contributing: a necessary rotation, heal, scout or reset can prepare the next useful exchange rather than count as wasted time.",
    practice:
      'Review one fight and count dead time: seconds spent neither pressuring, rotating, healing, scouting, nor resetting.',
    image: '/images/heroes/loki.png',
    tags: ['Lanes', 'Uptime', 'Poke'],
    links: [
      { label: 'Edited video', url: 'https://youtu.be/F6EFqod3Kn0?si=OufYyykEhYZXjgVO' },
      { label: 'Full masterclass', url: 'https://www.youtube.com/watch?v=AeVhuXpwjkM' },
    ],
  },
  {
    id: 'timing',
    category: 'Fundamentals',
    title: 'Timing and Target Priority',
    takeaway:
      "Pressure becomes a fight-winning opportunity when it reaches a target your team can punish. An isolated enemy, a missing cooldown or a player forced to look away can give the entry a purpose. Identify the target, the trigger that makes them vulnerable and your exit before turning the setup into a commitment.",
    practice:
      'Call your engage window in three words: target, trigger, exit. Example: "Luna, bubble out, left room."',
    image: '/images/heroes/psylocke.png',
    tags: ['Timing', 'Target Priority', 'Engage'],
    links: [
      { label: 'Timing masterclass', url: 'https://youtu.be/yftUQIsApMI?si=BkzIi2ynIWqEiaOD' },
      { label: 'Target priority', url: 'https://youtu.be/HoiwKJLR_tA?si=_oS8swCV9MkR7aOt' },
    ],
  },
  {
    id: 'vanguard',
    category: 'Roles',
    title: 'Carry on Vanguard',
    takeaway:
      "Vanguard value comes from shaping where the fight can happen. Claim ground the team can use and spend defensive resources to gain or preserve that space. Simply standing on the point does not explain whether your cooldowns helped the team move, hold or survive.",
    practice:
      'Track whether each cooldown created space, saved space, or was spent after the space was already lost.',
    image: '/images/heroes/the-thing.png',
    tags: ['Vanguard', 'Space', 'Cooldowns'],
    links: [{ label: 'Masterclass', url: 'https://youtu.be/TOZZRM5JnSM?si=ODAVv83RtZxvguXr' }],
  },
  {
    id: 'duelist',
    category: 'Roles',
    title: 'Carry on Duelist',
    takeaway:
      "A Duelist's final burst is easier when scouting, setup and a useful crossfire come first. Establish a threat before demanding an elimination; an enemy who has to turn toward your angle is already making a different decision. Connect that attention to the team's entry instead of treating the finish as a separate solo play.",
    practice:
      'Spend one fight setting up before your tank touches. If the enemy turns early, you already created value.',
    image: '/images/heroes/star-lord.png',
    tags: ['Duelist', 'Setup', 'Scouting'],
    links: [{ label: 'Masterclass', url: 'https://youtu.be/6FGNkCvqhgA?si=FSi0vTdUwu3O86xG' }],
  },
  {
    id: 'strategist',
    category: 'Roles',
    title: 'Carry on Strategist',
    takeaway:
      "Proactive support means choosing which problem needs your resources next. Stabilize the teammate in danger, pressure a useful lane when there is room, and retain utility for the enemy's way of winning the fight. The aim is a deliberate response rather than spending every available tool on the first pressure you see.",
    practice:
      'Before each fight, predict the enemy engage tool and decide which cooldown is reserved for it.',
    image: '/images/heroes/invisible-woman.png',
    tags: ['Strategist', 'Resources', 'Proactivity'],
    links: [
      { label: 'Strategist carry', url: 'https://youtu.be/K9Ce8VTHxuc?si=0HDhL7-D9wkvjCsJ' },
      { label: 'Proactivity', url: 'https://www.youtube.com/watch?v=SyYfpEgGLTA' },
    ],
  },
  {
    id: 'mindset',
    category: 'Mindset',
    title: 'Autopilot, Tilt, and Anxiety',
    takeaway:
      "The workbook treats autopilot, tilt, anxiety and consistency as practice problems rather than a reason to abandon deliberate decisions. Choose one cue you can return to under pressure, such as preparing your position or reviewing a death before another queue. A repeatable focus makes it easier to notice when attention has drifted.",
    practice:
      'Pick one focus cue per block: cover before damage, rotate after cooldowns, or review one death before queueing again.',
    image: '/images/heroes/mantis.png',
    tags: ['Mindset', 'Consistency', 'Review'],
    links: [
      { label: 'Autopilot', url: 'https://youtu.be/HUZttvb4XH4?si=4DvVVJi_s31CE0_7' },
      { label: 'Tilt', url: 'https://youtu.be/3leIrDmkHbs?si=oiLno2-O5oqqg9tT' },
      { label: 'Effective practice', url: 'https://www.youtube.com/watch?v=AqUXRb-zglI' },
    ],
  },
  {
    id: 'reviews',
    category: 'VOD Reviews',
    title: 'Self-review Framework',
    takeaway:
      "A replay is most useful when it reveals a decision you can repeat differently. Look back through setup, resource use, entry timing and target selection instead of stopping at a single frame to assign blame. Find the first choice that made a death likely, then carry one concrete adjustment into the next fight.",
    practice:
      'Review three deaths only. For each, write the first decision that made the death likely, then one fix you can apply next fight.',
    image: '/images/heroes/rocket-raccoon.png',
    tags: ['VOD Review', 'Practice', 'Coaching'],
    links: [
      { label: 'Self-review video', url: 'https://youtu.be/qbjD4v91UOk' },
      { label: 'Full masterclass', url: 'https://youtu.be/OLpW-9CDSg4?si=xxLSzkS5GKEYScjU' },
      { label: 'Community VODs', url: 'https://youtu.be/mXBQJ3ttUOA?si=j9LD6_i1xjPfEtAp' },
    ],
  },
  {
    id: 'analyses',
    category: 'Analyses',
    title: 'Pro Match Analysis Library',
    takeaway:
      "The workbook's OWL (Overwatch League) material examines engagement plans, spam and dive structures, brawl matchups, positioning and resources. Use it to practise reading how a team prepares and starts a fight. These examples come from another game, so study the planning questions rather than assuming its hero details transfer directly to Marvel Rivals.",
    practice:
      'Watch one pro fight with sound off. Pause before the engage and predict which lane starts the fight and which cooldown decides it.',
    image: '/images/heroes/captain-america.png',
    tags: ['Analysis', 'Team Comps', 'Resources'],
    links: [
      { label: 'Spam and dive', url: 'https://www.youtube.com/watch?v=A6R3V99lR88' },
      { label: 'Dive vs brawl', url: 'https://youtu.be/A-XdvhJ8lAQ' },
      { label: 'Resources', url: 'https://www.twitch.tv/videos/1844332579' },
    ],
  },
];

export const FIGHT_FLOW_STEPS: readonly FightFlowStep[] = [
  { label: 'Stage', note: 'Start near cover with an exit and a teammate who can trade.' },
  { label: 'Pressure', note: 'Open an angle that forces attention without spending every cooldown.' },
  { label: 'Collapse', note: 'Commit when the target is isolated, low-resource, or looking away.' },
  { label: 'Reset', note: 'Leave before the counter-engage turns your good angle into a trap.' },
];

export const HERO_WORKSHOPS: readonly HeroWorkshop[] = [
  {
    hero: 'Thor',
    role: 'Vanguard',
    image: '/images/heroes/thor.png',
    focus: "Use the Thor material to connect starting position with engagement timing and backline pressure. Read where the play begins, when it becomes useful and how the pressure changes the rest of the fight.",
    links: [
      { label: 'Thor guide', url: 'https://youtu.be/fFMfUcDSyCw?si=NtJ5C2ogdBx4NnEg' },
      { label: 'Backline pressure', url: 'https://youtu.be/4bpZdcmki_U?si=xrFvRkQ6MPBx9KBM' },
    ],
  },
  {
    hero: 'Rocket Raccoon',
    role: 'Strategist',
    image: '/images/heroes/rocket-raccoon.png',
    focus: "Connect angle control with movement routes and support uptime. In the Rocket examples, look for how a position leaves another route available while the player keeps contributing to teammates.",
    links: [
      { label: 'Power of angles', url: 'https://youtu.be/F8hgSt10t_U?si=yVm3ZIM77CwD9FmX' },
      { label: 'Mobility review', url: 'https://youtu.be/sFS0hdczwWM?si=R66GxtbYCjJWExvr' },
    ],
  },
  {
    hero: 'Magneto',
    role: 'Vanguard',
    image: '/images/heroes/magneto.png',
    focus: "Read the Magneto examples through dynamic positioning, bubble timing and target priority. Ask what ground the team needs, which pressure the protection answers and whether the chosen target helps gain control of the map.",
    links: [
      { label: 'Stop playing point', url: 'https://youtu.be/9Whi3bO36Mk?si=_FtR2RxrzaCP9O8C' },
      { label: 'Target priority', url: 'https://youtu.be/D_UzF_87l0k?si=U3XY66DBpAbaLExw' },
    ],
  },
  {
    hero: 'Jeff the Land Shark',
    role: 'Strategist',
    image: '/images/heroes/jeff-the-land-shark.png',
    focus: "Follow how space control and lane support keep a team's pressure stable. The Jeff material offers a role example for deciding where help is useful and which part of the fight needs to remain playable.",
    links: [{ label: 'Strategist masterclass', url: 'https://youtu.be/veOh-WKr4Xw?si=_s1DeN9iMPJtgUh7' }],
  },
  {
    hero: 'Invisible Woman',
    role: 'Strategist',
    image: '/images/heroes/invisible-woman.png',
    focus: "Use the Invisible Woman examples to examine sightlines, resources and angle control together. A position is useful when it allows support to reach the fight without spending every answer just to remain there.",
    links: [
      { label: 'Support effectively', url: 'https://youtu.be/-iBssvJkLXk?si=TdK-KchPCqEkt_Fb' },
      { label: 'Resources', url: 'https://youtu.be/Svs5zEB2JL8?si=26ga21tr8pssipf6' },
    ],
  },
  {
    hero: 'Star-Lord',
    role: 'Duelist',
    image: '/images/heroes/star-lord.png',
    focus: "The Star-Lord material connects scouting and setup with Duelist timing. Watch for the change from poke to committed burst, then ask what information or opening made that timing useful.",
    links: [
      { label: 'Scout and setup', url: 'https://youtu.be/YX2xq2RXV7o?si=1SxRqhS7w1LB4B6E' },
      { label: 'Duelist masterclass', url: 'https://www.youtube.com/watch?v=6FGNkCvqhgA' },
    ],
  },
];

export const ROLE_LIBRARY: readonly RoleLibrary[] = [
  {
    role: 'Vanguard',
    heroes: ['Captain America', 'Doctor Strange', 'Emma Frost', 'Groot', 'Hulk', 'Magneto', 'Peni Parker', 'The Thing', 'Thor', 'Venom'],
  },
  {
    role: 'Duelist',
    heroes: ['Black Panther', 'Black Widow', 'Blade', 'Hawkeye', 'Hela', 'Human Torch', 'Iron Fist', 'Iron Man', 'Magik', 'Mister Fantastic', 'Moon Knight', 'Namor', 'Phoenix', 'Psylocke', 'Scarlet Witch', 'Spider-Man', 'Star-Lord', 'Storm', 'Punisher', 'Winter Soldier', 'Wolverine'],
  },
  {
    role: 'Strategist',
    heroes: ['Adam Warlock', 'Cloak & Dagger', 'Invisible Woman', 'Jeff the Land Shark', 'Loki', 'Luna Snow', 'Mantis', 'Rocket Raccoon', 'Ultron', 'Gambit'],
  },
];
