export interface HeroGuideSection {
  title: string;
  points: string[];
}

export interface HeroUltimateGuide {
  name: string;
  plan: string;
  goodAgainst: string[];
  avoidInto: string[];
}

export interface HeroGuideImage {
  src: string;
  alt: string;
  label: string;
}

export interface HeroGuide {
  heroId: string;
  heroName: string;
  category: 'hero' | 'fundamentals';
  role: 'Vanguard' | 'Duelist' | 'Strategist' | 'Fundamentals';
  image: string;
  sourceLabel: string;
  sourceUrl?: string;
  relatedImages?: HeroGuideImage[];
  summary: string;
  poolJob: string;
  pickWhen: string;
  sections: HeroGuideSection[];
  ultimates: HeroUltimateGuide[];
}

export const HERO_GUIDES: HeroGuide[] = [
  {
    heroId: 'coach-mills-ultimate-beginners-guide',
    heroName: 'The Ultimate Beginner Guide',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/captain-america.png',
    sourceLabel: "Coach Mills - Marvel Rivals Ultimate Beginner's Guide",
    sourceUrl: 'https://www.youtube.com/watch?v=nyEnGfGdFtU',
    summary:
      'A first-match foundation for Marvel Rivals: learn what each hero brings, play the objective through winning fights, and develop a small flexible hero pool.',
    poolJob:
      'Build reliable fundamentals before chasing advanced mechanics: manage cooldowns, understand your role, fight with your team, and reset when the fight is lost.',
    pickWhen:
      'Start here if you are new to Marvel Rivals or hero shooters and want a practical overview before choosing a main or entering competitive play.',
    sections: [
      {
        title: 'A hero shooter is more than aim',
        points: [
          'Every hero has a distinct primary fire, set of abilities, and rhythm. Give yourself permission to experiment before deciding what fits.',
          'Matches are won through ability timing, teamwork, positioning, and cooldown management as much as raw aim.',
          'A cooldown is valuable when it creates a meaningful swing: damage that wins an opening, healing that saves a teammate, protection that denies an enemy play, or utility that changes the fight.',
          'Do not spend major abilities just because they are available. Ask what the ability can accomplish before you commit it.',
          'Passives shape a hero automatically; active abilities are the decisions you can deliberately improve through repetition.',
          'Ultimates charge through contribution and time, then can dramatically change a fight. Use them for a clear fight-winning purpose instead of holding them forever or throwing them away alone.',
        ],
      },
      {
        title: 'Understand the three role jobs',
        points: [
          'Strategists support the team with healing, utility, damage, and high-impact decisions. Healing matters, but they are not limited to being healbots.',
          'Vanguards survive pressure, contest valuable ground, and let teammates take safer angles. Their job is to create space the team can actually use.',
          'Duelists convert openings into pressure and eliminations. They can threaten isolated targets, backlines, and enemies caught out of position.',
          'Think of a Vanguard as the team’s durable front and a Duelist as its finishing pressure, while Strategists keep the fight workable and create options.',
          'Your role is a starting responsibility, not a script. Watch the current fight and help solve the problem your team actually has.',
        ],
      },
      {
        title: 'Learn heroes, synergies, and matchups',
        points: [
          'Some hero combinations create team-up benefits, but a hero does not need a synergy to be useful.',
          'Matchups are about tools: which abilities let one hero pressure, escape, deny, or punish another hero.',
          'You do not need to master the entire roster immediately. Playing unfamiliar heroes briefly still teaches you what their cooldowns look like from the other side.',
          'Composition matters, but flexibility matters more than forcing a rigid formula. Adapt to the map, your teammates, and the threats the enemy is actually using.',
          'When an enemy is repeatedly causing trouble, identify the tool enabling them and look for a hero, angle, or teammate response that limits it.',
        ],
      },
      {
        title: 'Choose a main without trapping yourself',
        points: [
          'Try heroes that look interesting, even if they do not immediately seem like your style. You learn fit by playing, not by guessing from a roster screen.',
          'Build comfort on roughly three or four heroes with different answers to common situations rather than spreading practice across the whole roster.',
          'Keep enough flexibility to handle bans, difficult matchups, and team needs, especially as you move into more competitive games.',
          'Do not let a tier list choose your main. Strength at the highest level can differ from what works for your experience, platform, and current skill.',
          'A hero you enjoy and understand gives you better practice than a supposedly optimal pick you do not know how to play.',
        ],
      },
      {
        title: 'Play modes through their important moments',
        points: [
          'In Convoy, checkpoint progress changes future spawns and is worth committing resources to. Force defenders away from the objective, then convert the win into movement.',
          'In Domination, the objective matters, but winning the full team fight creates the safest capture time. Do not trade a winnable fight for a few isolated seconds on point.',
          'Health packs, alternative routes, high ground, and destructible cover all change which positions are safe and which escapes are available.',
          'Learn maps with a simple question: where can I recover, rotate, or take a better angle before the next fight starts?',
          'Use the environment intentionally. A route or piece of cover is valuable when it lets your team apply pressure without giving the enemy an easy target.',
        ],
      },
      {
        title: 'Win fights before chasing progress',
        points: [
          'A team fight is the committed clash where both teams spend abilities and ultimates. Winning it usually creates more objective progress than trickling onto the objective alone.',
          'Stay close enough to support teammates and help focus the same problem. Six separate duels rarely beat coordinated pressure.',
          'If a fight is clearly lost, disengage and regroup. Feeding staggered eliminations gives the enemy more time and resources.',
          'After a win, take the secure progress available: capture, push, establish better positions, and prepare for the enemy return.',
          'Track resources across the fight. Cooldowns and ultimates are shared opportunities; a team that uses them with a plan has a major advantage.',
        ],
      },
      {
        title: 'Improve one repeatable habit at a time',
        points: [
          'Use early matches to learn, not to judge yourself. Pick one simple focus such as saving an escape cooldown, finding health packs, or grouping before every fight.',
          'Quick Play is a useful place to test heroes and limits. Competitive play asks for more awareness, flexibility, and resource discipline.',
          'Review a frustrating death with one question: what information, position, cooldown, or timing decision would have made it safer?',
          'Good progress comes from small repeated improvements. You do not need every mechanic at once to become a reliable teammate.',
          'Keep the game enjoyable. Curiosity and consistent practice are more useful long-term than forcing yourself into a hero or style you dislike.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'tank-fundamentals-turns-space',
    heroName: 'Tank Fundamentals: Turns And Space',
    category: 'fundamentals',
    role: 'Vanguard',
    image: '/images/heroes/captain-america.png',
    sourceLabel: 'Tank rank-up guide transcript',
    sourceUrl: 'https://www.youtube.com/watch?v=axEc0rgvYi4&t=1801s',
    relatedImages: [
      { src: '/images/heroes/magneto.png', alt: 'Magneto', label: 'Solo tank anchor' },
      { src: '/images/heroes/doctor-strange.png', alt: 'Doctor Strange', label: 'Point control' },
      { src: '/images/heroes/emma-frost.png', alt: 'Emma Frost', label: 'Frontline turns' },
      { src: '/images/heroes/venom.png', alt: 'Venom', label: 'Dive timing' },
      { src: '/images/heroes/hulk.png', alt: 'Hulk', label: 'Side-space bully' },
      { src: '/images/heroes/thor.png', alt: 'Thor', label: 'Angle clear' },
    ],
    summary:
      'A Vanguard fundamentals guide about taking turns, holding space, main tank vs off tank jobs, solo tanking, and using ultimates during the fight instead of forcing them as risky openers.',
    poolJob:
      'Hold as much useful space as possible without dying, read whose turn it is, and spend cooldowns when your team can actually follow up.',
    pickWhen:
      'Use this guide when you play Vanguard, fill solo tank, push too far without follow-up, sit cart after won fights, or struggle to understand when you should walk forward or give space.',
    sections: [
      {
        title: 'Tank is a fundamentals role',
        points: [
          'Vanguard is not only about being durable. The role asks for strong game awareness, map understanding, cooldown discipline, and timing.',
          'A tank player often sees the most information because they are near the front of the fight and can read what is happening in front of and behind them.',
          'Your rank-up path on tank is mostly fundamentals: knowing when to hold, when to give space, when to peel, when to support your team turn, and when to disengage.',
          'The two biggest carry habits are holding as much space as possible and not dying.',
          'You do not need to make every play yourself. You need to create playable fights for the rest of your team.',
        ],
      },
      {
        title: 'Understand turns',
        points: [
          'The guide frames Marvel Rivals fights as a turn-based rhythm: one team spends pressure, the other team answers, then space changes hands.',
          'Dive pressure usually goes first. If an enemy Venom dives your backline, your team has to spend attention and healing on that dive before you can safely walk forward.',
          'If you push alone while your own backline is being attacked, you may get no follow-up, burn all your resources, and die wondering why nobody came with you.',
          'When an enemy diver leaves low and their supports have to heal them, that can become your team turn. Walk forward and spend offensive cooldowns while the enemy is busy recovering.',
          'In front-to-back fights without divers, turns often come from whoever takes more poke first. If their tank is low and walking backward, your team can walk forward.',
          'When it is your team turn, spend offensive abilities. When it is the enemy turn, play cover, hold S, preserve health, and be willing to give space.',
        ],
      },
      {
        title: 'Main tank job: own main space',
        points: [
          'A main tank is responsible for the objective lane, the main choke points, and the path your team needs to cross.',
          'After winning a fight, do not default to sitting on cart. Take forward space, set a line, and make the enemy fight earlier.',
          'Think of map space like properties on a board. You want to hold as many useful properties as you safely can.',
          'Holding forward on offense can guarantee more cart progress even if you lose the next fight because the objective has moved during neutral.',
          'Forward holds should be soft holds, not ego holds. If multiple enemies walk out or your supports are far back on cart, give space before you get low.',
          'Hold close to cover, then gradually fall back from corner to corner instead of giving up the whole map at once.',
        ],
      },
      {
        title: 'Cover, corners, and right-hand peeks',
        points: [
          'You cannot hold space while taking infinite damage. Good tanking is about making enemies work for every point of health they take from you.',
          'Use corners and right-hand peeks to deal damage while exposing as little of yourself as possible.',
          'Do not farm support ultimates by eating free damage if that damage forces you out of space or gets you killed.',
          'Power positions matter. Sometimes high ground is more important than a default corner because a DPS on that high ground can create too many angles on you.',
          'Know your hero limits. A tank with easy vertical movement can contest power positions differently than Emma Frost or another less flexible frontline tank.',
          'If you cannot safely contest a power position, back up to the next cover line instead of dying for space your hero cannot hold.',
        ],
      },
      {
        title: 'Marking angles depends on your tank',
        points: [
          'Whether you should chase an enemy DPS angle depends on your hero range, mobility, and job in the composition.',
          'Magneto can often sit point and shoot because his range lets him influence angles without abandoning main.',
          'Emma Frost can poke some angles with beam, but she should not spend too much time walking away from point if that lets the enemy tank push into her backline.',
          'A low-range frontline tank should not chase every Star-Lord or ranged angle if doing so gives up main control.',
          'Mobile tanks such as Rogue, Hulk, Thor, Captain America, or Venom can contest some side angles more naturally, but they still need an exit plan.',
        ],
      },
      {
        title: 'Off tank job: clear side space',
        points: [
          'Main tanks usually hold the objective and main route. Off tanks can hold and clear the side spaces, high grounds, and off-angles.',
          'Mobile off tanks can bully enemy Duelists who are routing toward your backline, forcing them to spend cooldowns or leave before they get value.',
          'Clearing an off-angle can create a free turn for your team because the enemy angle has to retreat and receive healing.',
          'Captain America and Venom are especially good at pressuring poke heroes on height because they can close distance quickly and drive them away.',
          'Hulk, Rogue, and Thor can be very good into enemy divers because they can meet those divers on side routes and make them use resources before they reach your supports.',
          'Your goal as an off tank is not random chasing. Your goal is to remove the angles that stop your team from walking forward.',
        ],
      },
      {
        title: 'Solo tanking: play like a 600 HP support',
        points: [
          'Solo tanking is more limited than playing with two tanks. You usually cannot leave point or main space to take creative angles.',
          'The guide identifies Magneto, Emma Frost, and Doctor Strange as comfortable solo tank options because they can hold point, protect space, and support teammates reliably.',
          'The three main solo tank jobs are simple and non-negotiable.',
          'Main point 1: hold the objective. Contest point or main space for as long as you can without dying.',
          'Main point 2: shoot whoever your DPS are shooting. When your Duelists start a real play, add your damage and utility to their target.',
          'Main point 3: peel whoever is on your backline. If enemy divers hit your supports, protect your supports first so your team keeps enough sustain to hold.',
          'If your backline is being dove, take cover first because your supports are busy surviving and may not be able to heal you.',
          'Use bubbles, shields, poke, or pressure to help your supports live, then look forward again after the enemy dive leaves.',
          'When both teams dive at the same time, solo tank priority is usually protecting your supports before helping your own diver, because losing a support can make holding point impossible.',
        ],
      },
      {
        title: 'Support your Duelists on their turn',
        points: [
          'When solo tanking with three Duelists, the game puts more playmaking weight on the Duelists and asks you to support their timing.',
          'If your Iron Fist, Spider-Man, Phoenix, or another Duelist commits to a real angle, help by shooting their target, bubbling them if possible, or walking forward enough to make their play safer.',
          'Do not try to create a solo flank play as the only tank if it exposes your supports and abandons point control.',
          'Watch which target your DPS can actually reach. Sometimes your job is to weave shots past the enemy tank and help finish the squishier target your Duelist is pressuring.',
          'If your Duelists are ahead of you and likely die unless you help, the fight may require you to take a little more space and support that play.',
        ],
      },
      {
        title: 'Ultimate timing for tanks',
        points: [
          'The guide warns against using tank ultimates as risky fight openers, especially when solo tanking.',
          'Use tank ultimates during a turn, after the fight has started and enemy resources are already committed.',
          'A Doctor Strange ultimate can be stronger as peel when enemies dive your backline than as a predictable opener before anyone has spent cooldowns.',
          'A Magneto ultimate can deny healing on a low target during an active fight, turning a frontline trade into a kill and then becoming offensive pressure with the throw.',
          'Ultimates used during the fight are harder to counter because the enemy has fewer clean answers available.',
          'Your life is extremely valuable as the solo tank. Do not take unnecessary ultimate setups that get you killed and give the enemy infinite space.',
        ],
      },
      {
        title: 'Tank checklist',
        points: [
          'Ask whose turn it is before spending major cooldowns.',
          'Walk forward when your team has pressure or the enemy is recovering.',
          'Give space when the enemy is spending resources and your team needs to live.',
          'Hold the most forward space you can safely hold, then fall back by cover lines.',
          'Clear side angles if your hero has the mobility and range to do it without abandoning your job.',
          'When solo tanking, prioritize support survival, objective control, and helping your DPS target.',
          'Use ultimates during active turns instead of opening fights with risky, easy-to-counter setups.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'captain-america',
    heroName: 'Captain America',
    category: 'hero',
    role: 'Vanguard',
    image: '/images/heroes/captain-america.png',
    sourceLabel: 'Paz Captain America comprehensive guide',
    sourceUrl: 'https://www.youtube.com/watch?v=HZrBVN4tuik',
    relatedImages: [
      { src: '/images/heroes/venom.png', alt: 'Venom', label: 'Best tank partner' },
      { src: '/images/heroes/psylocke.png', alt: 'Psylocke', label: 'Dive follow-up' },
      { src: '/images/heroes/black-panther.png', alt: 'Black Panther', label: 'Backline collapse' },
      { src: '/images/heroes/iron-fist.png', alt: 'Iron Fist', label: 'Pressure duo' },
      { src: '/images/heroes/luna-snow.png', alt: 'Luna Snow', label: 'Support pairing' },
      { src: '/images/heroes/the-punisher.png', alt: 'The Punisher', label: 'Shield threat' },
    ],
    summary:
      'Captain America is a mobile dive Vanguard who wins through pressure, displacement, soft engages, backline disruption, and timely peel instead of sitting main and punching tanks all game.',
    poolJob:
      'Stage around the enemy, force support cooldowns, help friendly divers collapse, intercept flankers when your supports need help, and use Freedom Charge to engage, answer threats, or stall.',
    pickWhen:
      'Pick Captain America when your team can surround the enemy with dive pressure, when you need a Vanguard who can harass poke/backline heroes, or when your supports need a mobile tank who can peel without becoming stationary.',
    sections: [
      {
        title: 'General philosophy: do not sit main',
        points: [
          'The guide opens with a clear warning: Captain America does not get full value by sitting in main and punching tanks the entire game.',
          'His value comes from pressure and displacement. You either help set up a dive by surrounding the enemy team or intercept a flanker before they reaches your supports.',
          'If your team has divers like Psylocke, Daredevil, Iron Fist, or Black Panther, look to aid their backline pressure instead of playing a slow frontline trade.',
          'If your supports are struggling, flip the job: stop enemy flankers before they get a clean engage.',
          'Cap is at his best when he stages intelligently, draws a circle around the enemy team, forces resources, and then decides whether the next touch is a kill attempt or a reset.',
        ],
      },
      {
        title: 'Sentinel Strike: punch into shield pressure',
        points: [
          'Sentinel Strike starts with melee punches that deal 40 damage per punch and build charges under the reticle.',
          'After four charges, or after punching a target twice, Captain America gains mini shield throws that deal 45 damage per hit.',
          'The mini shield throws do not ricochet like Vibranium Energy Saw, but they automatically target enemies near the crosshair.',
          'The guide notes a practical aiming quirk: aiming slightly to the right of a target gives more generous homing than aiming to the left.',
          'The mini shields only travel about 25 meters, so they are not a long-range poke plan. They are a chase and pressure tool once you are already close.',
          'You can build Sentinel Strike charges off Groot walls, Loki clones, and Moon Knight ankhs, but not off inanimate shields such as Emma Frost shield.',
        ],
      },
      {
        title: 'Leading Dash and Super-Soldier Slam',
        points: [
          'Leading Dash gives Captain America a 33% sprint speed boost with no cooldown and no energy meter.',
          'You can sprint between mini shield throws to stay on targets, but if you spam sprint and throws too quickly, you can cancel the shield throw and lose damage.',
          'The guide recommends listening for the shield impact sound before throwing again so the rhythm stays clean.',
          'Sprint can be hold or toggle based on comfort. The guide cares more about doing the Captain America idea correctly than tiny sprint min-maxing.',
          'Jumping while sprinting unlocks Super-Soldier Slam, a ground slam that deals 30 damage and launches enemies upward.',
          'If you are already close, punch twice, slam, then follow with mini shield throws. If a friendly diver engages first, slam with them to help burst a support.',
          'Super-Soldier Slam can also be an escape tool, but it has a 12-second cooldown, so do not spend it casually if you will need it to leave.',
        ],
      },
      {
        title: 'Living Legend: shield for stuns and clutch blocks',
        points: [
          'Living Legend raises Cap shield and deflects projectiles in random directions, unlike Daredevil-style aiming deflects.',
          'Melee hits and beams do not deflect back, though some beam damage can still be blocked.',
          'The shield has 350 health and recovers 50 health per second while put away.',
          'You cannot spam the shield freely: after lowering it there is a short lockout, and if it breaks completely you wait longer before using it again.',
          'The guide says the shield is mainly for dodging stuns and surviving sticky moments, such as Luna snowballs or Hela stuns.',
          'It can also protect friendly supports from projectile pressure and certain ultimates, including Iron Man and Magneto situations.',
          'Do not hold shield just because it is available. Better pathing, cover, health packs, and support healing can solve many poke situations without spending your key defensive tool.',
        ],
      },
      {
        title: 'Liberty Rush: finish or escape, not both',
        points: [
          'Liberty Rush sends Captain America forward in a 12-meter charge that deals 30 damage.',
          'It can be used every 10 seconds regardless of whether Living Legend is up, down, or broken.',
          'During the dash, Cap is crowd-control immune, which lets him dodge tools such as Luna snowball, Doctor Strange ultimate, and even Jeff ultimate timing.',
          'The guide frames Liberty Rush as a tool to either finish a target quickly or get out of danger.',
          'Because the dash stops when it hits a target, it is not like Psylocke dash. You usually cannot use the same Liberty Rush to both damage through someone and escape cleanly.',
          'If the engage is only a soft engage to force resources, consider saving Liberty Rush so you can dodge CC and leave.',
        ],
      },
      {
        title: 'Vibranium Energy Saw and the core combo',
        points: [
          'Vibranium Energy Saw is the larger shield throw. It deals 70 damage on first hit, then can ricochet up to three times with reduced damage each bounce.',
          'Throwing it at the ground near a target can still ricochet into them, which makes aiming at the legs more consistent than trying to land perfect direct hits every time.',
          'Do not throw it too early from stealth or staging, because it alerts enemies and gives supports time to heal the damage.',
          'Do not hold it forever either. If you never weave it in, you lose finishing power and pressure.',
          'The guide combo is: sprint, jump, Vibranium Energy Saw, wait, left click, Liberty Rush, then left click.',
          'Use this harder combo when you and another diver are trying to kill. For a soft engage, use shield throw and slam pressure, then save Liberty Rush to leave or dodge crowd control.',
          'Cap abilities are simple alone but hectic together, so the guide recommends practicing the timings in the range until the rhythm feels natural.',
        ],
      },
      {
        title: 'Freedom Charge: mini support ultimate',
        points: [
          'Freedom Charge gives Captain America and nearby allies bonus health plus a 30% movement speed boost.',
          'On cast, Cap gains 150 bonus health and nearby allies gain 100 bonus health. After that, Cap radiates more bonus health over time while the ultimate is active.',
          'Try to pop it near teammates when possible so they receive the immediate bonus health and can use the trail/aura during the fight.',
          'The guide describes three major uses: engaging, countering medium threats, and stalling.',
          'As an engage, it lets Cap and his team move quickly into the enemy backline without spending a stronger support ultimate first.',
          'As a counter, it can answer medium-level threats such as Star-Lord ultimate, Psylocke pressure, Black Panther pressure, or moments where your backline needs immediate durability.',
          'As a stall tool, it makes Cap extremely hard to kill while he bumps enemies around and buys time on the objective.',
          'Consider turning on ally health bars for Captain America because the ultimate can save teammates like a support tool, but tanks do not naturally get the same critical health prompts supports do.',
        ],
      },
      {
        title: 'Counters and annoying matchups',
        points: [
          'The guide argues Emma Frost is not necessarily a hard counter if you are skilled on Captain America because Liberty Rush can dodge key CC and Cap mobility makes him hard to pin down.',
          'Peni Parker and The Thing are called out as more annoying Vanguard matchups.',
          'One practical ranked weakness is that some teammates only understand simple front-to-back brawls, so picking Cap instead of Magneto, Emma, or Strange can confuse your team plan.',
          'Winter Soldier is annoying because he can dash into you and force you to leave without mobility.',
          'Namor can be annoying because Cap cannot easily clear turrets alone, though Cap health pool helps him soak more than a squishy diver would.',
          'Punisher is dangerous if he can aim because he can shred your shield quickly and make your staging feel fragile.',
          'Duelists that mark or track you, such as Iron Fist and Daredevil, can make it much harder to take clean angles.',
          'Ultron is mentioned as a major answer to Freedom Charge because his pressure can burn through the bonus health plan.',
        ],
      },
      {
        title: 'Synergies: surround and collapse',
        points: [
          'Cap has a team-up with Winter Soldier that lets Bucky reposition to him, but the guide treats it as useful rather than the main reason to pick Cap.',
          'Venom is highlighted as the best tank partner because Cap and Venom can take different angles and collapse on the same target, instantly forcing support cooldowns.',
          'Angela can be added to create even more pressure: multiple huge health bars converging from different angles can overwhelm ranked teams.',
          'Dive or pressure Duelists such as Psylocke, Black Panther, Iron Fist, and Star-Lord fit Cap game plan because they want to surround enemies and cook the backline.',
          'Human Torch can pair well because Cap can punch enemies and force them to kite through Torch fire zones.',
          'Luna Snow is called out as a strong support pairing, while Mantis can make Cap engages more lethal without needing to overcommit.',
        ],
      },
      {
        title: 'VOD lesson: force cooldowns before kills',
        points: [
          'The Paulie VOD review reinforces that the whole Cap idea is not always killing immediately. It is pressuring enemies, forcing resources, and then taking the harder engage after cooldowns are gone.',
          'In one fight, Cap stages away from main, waits for the friendly Psylocke flank to be ready, then slams into supports once the enemy backline is vulnerable.',
          'After a pick or forced resource, he leaves instead of feeding, then re-enters when the next opening appears.',
          'The guide praises using Cap to clear space for a flanking Jeff, letting Jeff create a strong damage/healing angle from behind the enemy team.',
          'In chaotic triple-support fights, Cap should put out fires: pressure the threat that matters, force support ultimates, and use Freedom Charge so your own supports can ult second.',
          'If you cannot peel a backline threat because it is already too committed or too far gone, look for an equal or better play on the enemy backline instead of wasting time.',
        ],
      },
      {
        title: 'Soft engage discipline',
        points: [
          'A soft engage is a pressure touch designed to force cooldowns, not a full all-in.',
          'The VOD shows Cap jumping supports, forcing Mantis sleep or Luna snowball, then using Liberty Rush or shield discipline to leave before the punish lands.',
          'Many Cap players reach supports and assume the job is to keep holding primary fire. The guide says the better habit is to read the defensive cooldown and leave if the hard engage is not ready.',
          'Once sleep, snowball, runes, portals, or other support tools are forced, the next engage is much easier and much more dangerous.',
          'Soft pressure on supports can also starve healing from the enemy frontline, letting your team win point or kill the tank without Cap personally finishing the support.',
          'Good Captain America play is composure: do not go too deep, do not die for the first touch, and let the pressure stack until the fight cracks.',
        ],
      },
    ],
    ultimates: [
      {
        name: 'Freedom Charge: Engage',
        plan:
          'Use Freedom Charge after a soft engagement or as your team is ready to move so Cap, divers, and follow-up damage can flood the backline together.',
        goodAgainst: [
          'Backlines with forced cooldowns',
          'Dive partners such as Psylocke or Black Panther',
          'Teams that are slow to turn around',
          'Fights where you want speed without spending a major support ultimate first',
        ],
        avoidInto: [
          'Opening before your team can follow',
          'Using it far away from allies who need the bonus health',
          'Ultron pressure that can burn through the sustain plan',
        ],
      },
      {
        name: 'Freedom Charge: Counter-threat',
        plan:
          'Treat Cap ultimate like a mini support ultimate into medium threats. Pop it near your team when enemy pressure lands and use the movement speed to escape or turn.',
        goodAgainst: [
          'Star-Lord ultimate',
          'Psylocke or Black Panther diving supports',
          'Jeff Storm-style combo pressure',
          'Moments where supports would otherwise spend a bigger ultimate',
        ],
        avoidInto: [
          'Huge fight-ending ultimates that need stronger answers',
          'Using it after teammates are already split beyond the aura',
          'Silently using it when your supports are already committing their ultimates',
        ],
      },
      {
        name: 'Freedom Charge: Stall',
        plan:
          'Use Freedom Charge to buy objective time, keep yourself alive, bump enemies around with shield interactions, and survive long enough for teammates to return or finish the fight.',
        goodAgainst: [
          'Last-second objective contests',
          'Overtime stalls',
          'Messy fights where living is the win condition',
          'Buying time for support ultimates or respawns',
        ],
        avoidInto: [
          'Stalling alone with no realistic team return',
          'Running away from the objective trail value',
          'Treating stall as permission to ignore cover completely',
        ],
      },
    ],
  },
  {
    heroId: 'jubilee',
    heroName: 'Jubilee',
    category: 'hero',
    role: 'Strategist',
    image: '/images/heroes/jubilee.png',
    sourceLabel: 'True Vanguard advanced Jubilee guide',
    sourceUrl: 'https://www.youtube.com/watch?v=-XnynKZDHls',
    relatedImages: [
      { src: '/images/heroes/the-thing.png', alt: 'The Thing', label: 'Brawl anchor' },
      { src: '/images/heroes/magneto.png', alt: 'Magneto', label: 'Frontline partner' },
      { src: '/images/heroes/emma-frost.png', alt: 'Emma Frost', label: 'Frontline partner' },
      { src: '/images/heroes/devil-dinosaur.png', alt: 'Devil Dinosaur', label: 'Frontline partner' },
      { src: '/images/heroes/blade.png', alt: 'Blade', label: 'Vampiric Kin' },
    ],
    summary:
      'Jubilee is an active brawl and tempo Strategist who leapfrogs charged Blooming Balls with her frontline, detonates them for burst sustain and utility, and chains Sparkle Marks to keep enhanced Energy Plasmoids running.',
    poolJob:
      'Move the team forward one healing zone at a time, maintain the orb-detonation-mark loop, add damage while enhanced, and use Sparking Sprint to preserve momentum or escape danger.',
    pickWhen:
      'Pick Jubilee with a durable, grouped frontline that can occupy her Blooming Balls. Be cautious when your team is built around flyers, flankers, and multiple dive heroes who spread beyond her area healing.',
    sections: [
      {
        title: 'Playstyle: leapfrog the frontline',
        points: [
          'The guide describes Jubilee as a constant game of leapfrog: place a healing orb ahead of your Vanguards, let them step into it, charge and detonate it, then place the next orb farther forward.',
          'Each new Blooming Ball marks the next piece of space your team can safely occupy. Your healing layout should encourage forward movement instead of trailing behind the fight.',
          'Jubilee is not a passive healbot. She needs continuous involvement and clean ability sequencing to avoid low-output gaps.',
          'Think of her kit as a merry-go-round: build momentum with Sparking Sprint, ride that momentum through Sparkle Marks, then restart the cycle before it slows down.',
          'Her best fights are grouped brawls where healing, damage, detonations, buffs, and enemy debuffs can all affect several heroes at once.',
        ],
      },
      {
        title: 'Blooming Ball: feed the orb correctly',
        points: [
          'Blooming Ball starts as a smaller healing and damage field, then grows in radius and healing output as it affects targets or receives Jubilee fire.',
          'Your goal is to fully charge each useful orb. A full orb covers more space, provides stronger sustain, creates a larger detonation, and refreshes its remaining lifetime.',
          'The fastest charge method is placing the orb on an injured ally and shooting that ally. The ally receives direct healing and orb healing while the same shots rapidly feed the orb.',
          'If nobody inside needs healing, activate Sparking Sprint and shoot the orb with enhanced Energy Plasmoids. Shooting it with normal primary fire is the slowest option.',
          'Do not abandon an orb after the frontline moves. Recall it from within range, even through a wall, to shorten the next cooldown and redeploy it where the fight is going.',
          'Detonation requires line of sight to the orb, while recall does not. Position with that difference in mind before you lose the angle.',
        ],
      },
      {
        title: 'Dazzling Detonation and Sparkle Marks',
        points: [
          'Detonate the largest practical orb so the explosion reaches more allies and enemies.',
          'Allies receive burst healing, healing over time, and movement speed. Enemies take damage, become blinded, and receive Vulnerability.',
          'A well-timed blind can disrupt an enemy ultimate that depends on vision or aim. Keep the option in mind instead of detonating only for healing numbers.',
          'Every affected target receives a Sparkle Mark. Shoot a marked ally or enemy to consume the mark and activate enhanced Energy Plasmoids.',
          'Consuming an allied mark grants bonus health and increases incoming healing, creating Jubilee strongest single-target stabilization window.',
          'Consuming an enemy mark adds burst damage. Choose the mark that solves the current fight rather than automatically shooting the nearest target.',
          'When several marks are available, consume one immediately and stagger the others before they expire to refresh enhanced fire instead of spending every mark at once.',
        ],
      },
      {
        title: 'Core rotation: keep the loop spinning',
        points: [
          'Open the fight by placing Blooming Ball just ahead of the frontline so it tracks a Vanguard instead of drifting back to Jubilee.',
          'Activate Sparking Sprint and use enhanced Energy Plasmoids on an injured ally inside the orb, or on the orb itself, until it is fully charged.',
          'Cancel Sparking Sprint once the charge is complete so its resource begins recovering.',
          'Detonate the charged orb, then immediately consume one of the new Sparkle Marks to reactivate enhanced fire.',
          'Place the next orb ahead of the frontline and rapidly charge it with enhanced Energy Plasmoids.',
          'Heal an ally, pressure an enemy, or consume another mark while waiting for Dazzling Detonation to return, then detonate the new orb and repeat.',
          'The shorthand is: orb, sprint, charge, detonate, consume a mark, new orb, charge, repeat.',
        ],
      },
      {
        title: 'Energy Plasmoids: play for the enhanced state',
        points: [
          'Normal Energy Plasmoids provide modest healing and damage. Jubilee output rises when Sparking Sprint or a consumed Sparkle Mark activates the enhanced version.',
          'Enhanced fire shoots much faster, consumes no ammo, and raises both healing and damage output, so the entire ability loop should maximize its uptime.',
          'Use the enhanced stream to burst-heal a marked ally, charge the next orb, help burn the enemy frontline, or punish an exposed flyer.',
          'Do not reload during a window where enhanced fire is available. Hold the trigger and turn that temporary state into as much useful output as the fight allows.',
          'During quiet but unsafe moments, shoot the active orb to keep it charged. If the fight is truly over, recall it and recover resources instead.',
        ],
      },
      {
        title: 'Sparking Sprint: start, conserve, escape',
        points: [
          'Sparking Sprint provides movement speed, enhanced fire, and a boosted jump, making it both the starter for Jubilee rotation and her escape tool.',
          'The ability uses a resource meter. Cancel it as soon as the charge or reposition is complete instead of draining the entire meter.',
          'The boosted jump can quickly return Jubilee to her team, leave dangerous ground effects, or escape an enemy ultimate.',
          'When Sparking Sprint ends, Jubilee creates a small explosion that knocks back nearby enemies and heals nearby allies, including herself.',
          'Stay aware of the exit burst in close brawls, but do not remain in danger merely to force it. Survival keeps the full healing loop available.',
        ],
      },
      {
        title: 'Positioning and team composition',
        points: [
          'In a committed brawl, play near the Vanguards and inside your own Blooming Balls rather than defaulting to a distant backline position.',
          'Sharing the orb gives Jubilee self-sustain while her enhanced fire and detonations pressure enemies around the same frontline.',
          'A sturdy anchor such as The Thing, Magneto, Emma Frost, or Devil Dinosaur gives the orbs a reliable center and makes the leapfrog plan easy to read.',
          'If both Vanguards dive away, attach the plan to the most reliable grounded ally who can function as a temporary frontline.',
          'Jubilee loses efficiency when flyers, flankers, and dive tanks scatter in several directions because one area cannot sustain all of them.',
          'Use enhanced primary fire to briefly help an ally outside the main orb, then return attention to the grouped frontline before its sustain collapses.',
        ],
      },
      {
        title: 'Team-Ups and common mistakes',
        points: [
          'The guide strongly favors The Hood Team-Up because enhanced Energy Plasmoids become hitscan, can critically hit, and provide self-healing through damage.',
          'That passive benefit matches Jubilee goal of near-constant enhanced-fire uptime and helps her survive while contributing meaningful frontline damage.',
          'Blade Vampiric Kin can grant nearby allies Life Steal and becomes stronger with Blade, but the guide considers its cooldown-based value less consistent than The Hood passive.',
          'Do not shoot a healthy ally to charge an orb; no missing health means those shots cannot feed it through healing.',
          'Do not let old orbs expire behind the team. Recall and redeploy them.',
          'Do not consume every Sparkle Mark immediately. Stagger marks to extend enhanced fire.',
          'Do not stand far behind a grouped brawl, but also do not follow a scattered composition into several disconnected fights.',
        ],
      },
    ],
    ultimates: [
      {
        name: 'Firework Finale',
        plan:
          'Use the fast-charging ultimate proactively to establish or take space. Keep allies inside its healing ring, pressure enemies with enhanced fire, and contract or expand the ring only when the displacement is worth interrupting your normal actions.',
        goodAgainst: [
          'The first major team fight before enemy support ultimates are ready',
          'Grouped brawls where healing and damage can affect several targets',
          'Enemies holding a support ultimate field or a tight objective space',
          'Frontlines that can advance behind repeated knockback pressure',
        ],
        avoidInto: [
          'Contracting the ring when allies urgently need its healing',
          'Repeated ring animations when enhanced fire could secure eliminations',
          'Casting after the team has already scattered or lost the fight',
        ],
      },
    ],
  },
  {
    heroId: 'deadpool',
    heroName: 'Deadpool',
    category: 'hero',
    role: 'Vanguard',
    image: '/images/heroes/deadpool-vanguard.png',
    sourceLabel: "Fifth's Tankpool video guide",
    sourceUrl: 'https://www.youtube.com/watch?v=JJoZw60nFto&t=317s',
    summary:
      'Tankpool is not a sit-main damage sponge. He wins through pressure, disruption, pacing, stance swaps, upgrade discipline, shield timing, and controlled aggression.',
    poolJob:
      'Force attention, make the enemy team uncomfortable, build style points, and cycle in and out of pressure without exploding.',
    pickWhen:
      'Use Tankpool when your team benefits from chaos control: forcing cooldowns early, pressing supports, taking aggressive space, or stalling long enough to become impossible to ignore.',
    sections: [
      {
        title: 'Actual role: control chaos',
        points: [
          'Do not play Tankpool as a basic tank who sits main, hard-frontlines, soaks damage all game, and tries to stat-check everyone.',
          'His real value is pressure, disruption, pacing, and controlled aggression.',
          'Your job is to constantly force attention onto yourself while making the enemy team uncomfortable.',
          'Sometimes that means taking aggressive space and forcing people backward.',
          'Sometimes that means pressing supports so your DPS can move forward more easily.',
          'Sometimes that means forcing enemy cooldowns before the real fight even starts.',
          'Sometimes your value is simply surviving long enough that the enemy cannot ignore you.',
          'Every resource enemies spend dealing with you makes the fight easier for the rest of your team.',
          'Tankpool works best when he flows in and out of pressure instead of standing still.',
          'Keep repositioning, rotating angles, swapping stances, creating pressure, backing up, and re-engaging once resources return.',
          'Hard-forcing every engage without thinking will get you instantly deleted, especially after nerfs.',
          'If you cycle pressure properly, force attention, and survive through chaos, Tankpool becomes extremely disruptive.',
        ],
      },
      {
        title: 'Style points and upgrade discipline',
        points: [
          'Style points are the foundation of Tankpool upgrades.',
          'Your upgrades are what let Tankpool become oppressive during fights.',
          'If you hard-engage before farming style points, you are fighting at half strength.',
          'Many Tankpool players feel useless because they force pressure before building momentum.',
          'Build upgrades naturally before committing heavy pressure: poke people, pressure corners, force resources, and survive long enough to stack upgrades.',
          'Once upgraded, Tankpool becomes much harder to shut down: sustain is stronger, pressure is harder to ignore, cooldowns matter more, and enemies must respect your space.',
          'Fully upgraded Tankpool is a very different threat from zero-upgrade Tankpool.',
          'Take pictures whenever you get a kill.',
          'Close-range pictures give more style points; ranged pictures give fewer points, but both are useful.',
          'Taking a picture also provides an invincibility frame, so there is no reason to skip it after a kill.',
          'The guide recommends Ban Hammer first because it adds damage even when enemies are not missing.',
          'The E upgrade gives more attack speed with guns or swords, makes allies take less damage, and taunts enemies.',
          'The dash upgrade is valuable because it lets you dash twice instead of once.',
          'Gun upgrades are excellent because they add more damage.',
          'Upgrade priority can alternate depending on the enemy composition.',
        ],
      },
      {
        title: 'Master the whole kit: pistols and swords',
        points: [
          'Tankpool has pistols and swords, and each stance has its own cooldowns.',
          'Swap naturally between pistols and swords to get consistent value instead of playing only one stance.',
          'Use pistols at long range.',
          'When enemies enter your close effective range, swap to swords to punish that gap.',
          'Swords are strong for taking space and getting picks on targets who move too frequently to aim at cleanly.',
          'Swords are especially useful for pressuring supports in the backline because a bouncing Tankpool is hard to hit.',
          'Swords also make people back away, which is space control.',
          'When supports retreat from your dash pressure, your team gains natural space and your duelists can get more value.',
          'Mobility is not only for engaging. Every mobility tool should help you get in and get out.',
          'If you feel stuck, are taking too much damage, or expect to die, use dash to disengage.',
          'You can combine dash with other parts of the kit to escape bad situations.',
        ],
      },
      {
        title: 'Dash range and sword combo',
        points: [
          'The dash radius shown in the guide is about 10 meters.',
          'The ideal sword combo is dash, jump, then slash.',
          'The jump matters because no-jump versions are slower and less fluid.',
          'Practice the combo slowly first: dash, jump, slash.',
          'Then practice the faster version until it becomes natural.',
          'Practice the combo without E and with E so you understand both unupgraded and attack-speed-increased timing.',
          'Sword attacks can crit, so aim for the head during the combo when possible.',
          'With the attack-speed increase, the sword sequence becomes much faster and can secure kills more reliably.',
          'A frequent pattern is to use the gun ultimate on a support, then use swords to finish the kill more easily.',
        ],
      },
      {
        title: 'Ban Hammer discipline',
        points: [
          'Ban Hammer is the guide author’s favorite part of Tankpool’s kit, but many players misuse it because they do not understand the mechanics.',
          'Unupgraded Ban Hammer gives a large burst of survivability when dropped on a target.',
          'It gives instant bonus health and steady healing over time.',
          'It also taunts the target with an icon.',
          'If the taunted target shoots and misses, they instantly take damage and Tankpool gains even more bonus health.',
          'This punishes enemies for panicking.',
          'When upgraded, Ban Hammer becomes much more lethal.',
          'The upgraded version adds heavy damage over time on top of the base effects.',
          'The target takes damage every second even if they do not shoot and do not miss.',
          'If they start missing while upgraded Ban Hammer is active, the damage becomes even worse.',
          'The guide heavily favors dropping upgraded Ban Hammer on Strategists because they are the enemy team’s lifeline.',
          'When you lock upgraded Ban Hammer onto an enemy support, they are put in a lose-lose situation: they take constant damage, and if they try to heal teammates while missing, they take more.',
          'This melts supports and disrupts their rhythm.',
        ],
      },
      {
        title: 'Sword ultimate usage',
        points: [
          'The guide says the sword ultimate is not used as often by the author.',
          'When you do swap to the katana ultimate, its biggest value is survival.',
          'It gives a movement boost and chunks of healing over time.',
          'Treat it as a defensive tool to buy time, stall point, or stay alive under heavy focus fire.',
          'The goal is to survive long enough for your team to swing momentum back.',
        ],
      },
      {
        title: 'Plushie Shield discipline',
        points: [
          'The guide emphasizes this is Plushie Shield, not Doctor Strange shield.',
          'Base Plushie Shield has 300 health.',
          'Upgraded Plushie Shield reaches 400 health and gains a little more radius.',
          'The tool is niche, but its utility is very strong when used correctly.',
          'Save it to deny massive enemy ultimates.',
          'Drop it to cut off an enemy support’s line of sight so they cannot heal their tank.',
          'Use it to block damage for a split second so you can reset and get healed.',
          'You can also use it to take space.',
          'If Doctor Strange is outside the shield, or you are outside relative to him, it can block the interaction; if he walks inside, the situation changes.',
          'Enemies and supports cannot heal through it, so you can trap a support and isolate a kill.',
          'A Duelist can shred through the shield in about two seconds, so do not treat it as permanent cover.',
          'Use it strategically: it can temporarily block damage, but it will fall.',
        ],
      },
      {
        title: 'Passive: Healing Factor',
        points: [
          'Healing Factor triggers when you take massive burst damage or get hit by a lethal one-shot ability.',
          'It gives a brief window of invincibility and rapid healing to keep you alive.',
          'It effectively acts like a second life.',
          'It has a strict 45-second cooldown.',
          'You cannot fully control when it triggers, so play your life carefully and try not to pop it too early.',
        ],
      },
      {
        title: 'Tank discipline in full fights',
        points: [
          'Tankpool discipline is about knowing your limits, playing your life, and putting your team in a position to win.',
          'The guide’s example focuses on surviving and stalling the objective against the odds.',
          'Even when the ending gets messy, surviving long enough can be the reason your team still has a chance to win.',
          'Your job is not always to get the clean finish yourself. Sometimes your job is to keep the fight alive until your team can recover momentum.',
        ],
      },
    ],
    ultimates: [
      {
        name: 'The Ban Hammer / Gun Ultimate',
        plan:
          'Prioritize Strategists because they are the enemy team’s lifeline. Upgraded Ban Hammer creates constant damage, punishes missed shots or missed healing attempts, and breaks support rhythm.',
        goodAgainst: [
          'Enemy Strategists',
          'The Punisher ultimate',
          'Moon Knight ultimate if it misses targets',
          'Squirrel Girl',
          'Hitscan heroes',
          'Ultron ultimate',
          'Jeff while he is actively healing',
        ],
        avoidInto: [
          'Jeff if he goes underground and stops healing',
          'Targets who can completely disengage before the pressure matters',
          'Low-value DPS targets when an enemy support is available',
        ],
      },
      {
        name: 'Katana / Sword Ultimate',
        plan:
          'Use it mainly as a survival ultimate: movement speed plus healing over time lets you buy time, stall point, or live through heavy focus fire.',
        goodAgainst: [
          'Heavy focus fire',
          'Objective stall situations',
          'Moments where your team needs time to re-enter',
          'Chaotic fights where staying alive creates more value than chasing damage',
        ],
        avoidInto: [
          'Clean disengage situations where you can save the ultimate',
          'Fights already lost with no team follow-up',
          'Using it only for damage when survival is the real value',
        ],
      },
      {
        name: 'Magical Unicorn Shield / Plushie Shield',
        plan:
          'Use it as a short, tactical denial tool: block an ultimate, cut healing line of sight, isolate a support, or buy a brief reset window.',
        goodAgainst: [
          'Magneto ultimate',
          'Support healing lines',
          'Isolating a support inside or outside the shield',
          'Brief damage blocks while resetting',
          'Taking space through a dangerous angle',
        ],
        avoidInto: [
          'Phoenix ultimate because it cuts through',
          'Duelists who can shred the 300-400 health shield quickly',
          'Treating it like permanent cover',
          'Dropping it without a specific line-of-sight or ultimate-denial purpose',
        ],
      },
    ],
  },
  {
    heroId: 'neutral-game-fundamentals',
    heroName: 'Neutral Game Fundamentals',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/doctor-strange.png',
    sourceLabel: 'N / Nen - Neutral Game transcript',
    summary:
      'Neutral is the state before either side has a clear advantage: both teams are controlling space, baiting resources, and waiting for the mistake that opens the fight.',
    poolJob:
      'Use movement, spacing, cooldown tracking, and pressure to create a small advantage before the big engage, pick, or ultimate chain begins.',
    pickWhen:
      'Use this guide when people talk about neutral and you are not sure what it means, or when every fight feels like nothing matters until ultimates start flying.',
    sections: [
      {
        title: 'Neutral is before the big moment',
        points: [
          'Neutral is everything that happens before and between the obvious fight-swinging moments.',
          'In a fighting game, the flashy parts are combos, powered-up states, and super moves. Neutral is the movement, spacing, jabs, baiting, and waiting that happens before those moments land.',
          'In Marvel Rivals, the flashy parts are big engages, eliminations, and ultimates. Neutral is the quieter phase where both teams are trying to earn the right to make one of those plays.',
          'A neutral state means neither team has a clear advantage yet. Both sides are looking for space, information, cooldowns, damage, and a mistake to punish.',
          'Neutral is not doing nothing. It is the part of the game where players are testing each other without fully committing.',
        ],
      },
      {
        title: 'The fighting game comparison',
        points: [
          'The transcript uses Tekken as the clean example because fighting games make neutral easier to see.',
          'Players may look like they are only stepping forward, backing away, poking, or waiting, but they are actually controlling space and baiting unsafe actions.',
          'The goal is to make the opponent press the wrong button, move into the wrong range, or spend a powerful option at the wrong time.',
          'Once that mistake happens, the player can cash out with the big combo, powered-up move, or super.',
          'The same principle applies in team games: the big play usually comes after a smaller neutral mistake creates permission to commit.',
        ],
      },
      {
        title: 'Neutral in Marvel Rivals',
        points: [
          'In Marvel Rivals, neutral is about cooldowns, space control, positioning, baiting, and waiting for the enemy team to push too hard or too little.',
          'Both teams are trying to control the playable area of the map without being punished.',
          'Both teams are tracking resources: their own cooldowns, enemy cooldowns, ultimates, defensive saves, mobility, and healing tools.',
          'A good neutral exchange can be as simple as forcing an enemy to waste a cooldown while your team keeps its resources intact.',
          'A bad neutral exchange is giving the enemy the first opening by walking into danger, spending an important tool for no value, or overextending before your team is ready.',
        ],
      },
      {
        title: 'Why ultimates make neutral feel muddy',
        points: [
          'The transcript argues that Marvel Rivals does have neutral, but frequent ultimates can make neutral feel less important than it should.',
          'When ultimates happen constantly, matches can feel like both teams are mostly racing to build the next fight-winning button.',
          'Strategist ultimates can erase danger or create huge sustain windows, while Duelist ultimates can delete players quickly.',
          'Because those ultimates counteract and chain into each other, the quieter skill expression before the ultimate phase can feel compressed.',
          'That does not mean neutral is fake. It means you have to recognize the neutral phase before the ultimate lines start stacking.',
        ],
      },
      {
        title: 'What you are looking for',
        points: [
          'Look for enemy cooldowns spent too early. A movement tool, shield, stun, defensive save, or healing burst can become the signal that your team can press.',
          'Look for enemies who push too far. Overextension is one of the clearest neutral mistakes because it gives your team a target before the enemy is ready to trade back.',
          'Look for enemies who push too little. If the enemy refuses to contest space, your team can move forward, take angles, and start the next fight from a stronger position.',
          'Look for your own openings too. If your team has better cooldowns, stronger angles, or healthier players, neutral has already started tilting in your favor.',
          'The point is to notice the moment of weakness before everyone commits at once.',
        ],
      },
      {
        title: 'How each role plays neutral',
        points: [
          'Vanguards play neutral by testing space, threatening forward movement, protecting key lanes, and watching for the enemy to spend tools that make a push safer.',
          'Duelists play neutral by pressuring angles, poking, threatening backlines, and making the enemy respect their position before committing to a kill.',
          'Strategists play neutral by keeping the team stable, preserving major saves, holding safe sightlines, and using utility to deny the enemy opening.',
          'No role should treat neutral as permission to stand still. Everyone is either controlling space, denying space, baiting resources, or preparing for the punish.',
          'The best neutral plays often look small until the fight starts and the enemy is missing the cooldown, position, or health they needed.',
        ],
      },
      {
        title: 'Neutral checklist',
        points: [
          'Ask whether either team has a clear advantage yet. If not, you are probably in neutral.',
          'Ask what space your team is trying to control and what space the enemy is trying to protect.',
          'Ask which cooldowns matter most before the fight can safely begin.',
          'Ask whether the enemy just made a mistake by pushing too hard, backing up too far, or spending a resource too early.',
          'Ask whether your next action creates pressure without opening your team to an easy punish.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'survival-discipline',
    heroName: 'Survival Discipline',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/black-cat.png',
    sourceLabel: 'Original survival discipline video',
    sourceUrl: 'https://www.youtube.com/watch?v=QzdA27zMupI&list=PL5TQ7tktRWOC3sAGM2Fg-TdOQTDSxMHd6',
    summary:
      'Survival discipline is the skill of staying alive long enough to keep pressure, information, angles, and fight influence active.',
    poolJob:
      'Maintain pressure without throwing your life away for ego chases, low-health targets, or trades that remove your influence from the fight.',
    pickWhen:
      'Use this guide when you are dying after forcing plays, chasing low targets too far, or trading your life even though your pressure was more valuable than the kill.',
    sections: [
      {
        title: 'The overlooked skill: play your life',
        points: [
          'One of the biggest mistakes players make at every rank is not knowing how to play their life.',
          'Many players think value only comes from kills.',
          'They see someone low, force the chase, secure the elimination, and immediately die for it.',
          'In their head, the trade feels worth it, but a lot of the time it is not.',
          'This is especially true if you are the player creating pressure, controlling angles, and forcing resources.',
          'Survival is not passive. It is one of the most overlooked skills in the game.',
        ],
      },
      {
        title: 'What a trade actually costs',
        points: [
          'If you are dictating the pace of the lobby, trading your life for a support or DPS can be a net loss for your team.',
          'The moment you die, your active pressure disappears.',
          'Your angle disappears.',
          'Your target priority disappears.',
          'Your ability to influence the fight disappears.',
          'The enemy team gets to breathe again because they no longer have to account for you.',
          'Higher-elo players do not only ask, "Can I get this kill?" They ask, "Is this kill worth dying for?"',
          'Sometimes the strongest play is not securing the elimination.',
          'Sometimes the strongest play is forcing three people to turn around, forcing cooldowns, forcing resources, and walking away alive.',
        ],
      },
      {
        title: 'Pressure without the kill',
        points: [
          'The guide uses Black Cat as the example: when flanking, the goal is not always to kill someone.',
          'Sometimes the goal is simply to make the enemy support look at you instead of healing their tank.',
          'Sometimes the goal is to force defensive cooldowns.',
          'Sometimes the goal is to create attention and then leave.',
          'You do not always need the kill immediately.',
          'You do not always need the flashy play.',
          'If the enemy team has no resources left and your team walks forward for free, you created real value.',
          'Your presence creates a worry factor: enemies have to think about where you are and whether someone is in their backline.',
          'That kind of value often does not show on the scoreboard.',
        ],
      },
      {
        title: 'Alive pressure changes enemy behavior',
        points: [
          'If you are holding an angle, the enemy has to respect it.',
          'If you are threatening a flank, the enemy has to respect it.',
          'If you are alive, the enemy has to account for you.',
          'When you are dead, they do not.',
          'Good players will burn cooldowns, disengage, grab health packs, wait for resources, reset, and then re-enter the fight.',
          'Cooldowns are often shorter than death timers.',
          'Surviving also has a mental effect: when you refuse to die, enemies get impatient.',
          'They overcommit, tunnel vision, and chase plays that are not really there because you have been annoying them for minutes.',
          'That impatience is often where the fight falls apart for them.',
        ],
      },
      {
        title: 'Let low-health targets go',
        points: [
          'One of the hardest things to learn is letting opportunities go.',
          'Let the 10 HP target escape when chasing them would ruin your position or cost your life.',
          'Let the fight breathe instead of forcing the heroic play.',
          'The guide uses Star-Lord as the example: chasing a low target into a room where you lose your spacing advantage is usually an ego play.',
          'You do not need that kill if the target is already out of the fight.',
          'A low enemy searching for healing or a health pack is no longer impacting the team fight.',
          'Move on to the next target and keep applying pressure.',
        ],
      },
      {
        title: 'Most deaths are commitment problems',
        points: [
          'Most deaths do not happen because players lack mechanics.',
          'They happen because players convince themselves they need one more shot.',
          'Or one more dash.',
          'Or one more second.',
          'Or one more chase.',
          'Then they end up staring at the respawn screen.',
          'Every time that happens, they lose more value than they realize.',
        ],
      },
      {
        title: 'Staying alive collects information',
        points: [
          'Every second you are alive, you collect information.',
          'You see rotations.',
          'You see cooldowns.',
          'You see who wants to take an angle.',
          'You see who wants to play safe.',
          'You create pressure simply by existing on the map.',
          'The longer you are alive, the more chances you have to impact the game.',
          'One good angle can win a fight.',
          'One good target swap can win a fight.',
          'One good cooldown force at the right time can win a fight.',
          'None of that can happen from the spawn room.',
        ],
      },
      {
        title: 'Survival is active, not passive',
        points: [
          'Surviving does not mean hiding.',
          'It does not mean refusing to take risks.',
          'It means understanding the difference between a good opportunity and a bad commitment.',
          'It means knowing when to push, when to pressure, when to disengage, and when to let a play go and fully reset.',
          'The best players are not forcing something every five seconds.',
          'They constantly give themselves another opportunity to make an impact.',
          'Those opportunities stack up: another angle, another cooldown forced, another support pressured, another fight won.',
        ],
      },
      {
        title: 'Measure pressure, not only kills',
        points: [
          'The main takeaway is to stop measuring value only by the kills you secure.',
          'Start measuring value by the pressure you maintain.',
          'Some of the most impactful players in a lobby are not the ones forcing the most fights.',
          'They are the players surviving long enough to influence every fight.',
          'That is survival discipline.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'engagement-discipline',
    heroName: 'Engagement Discipline',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/star-lord.png',
    sourceLabel: 'Stop Forcing Fights video guide',
    sourceUrl: 'https://www.youtube.com/watch?v=FwU4jGEaUIQ&list=PL5TQ7tktRWOC3sAGM2Fg-TdOQTDSxMHd6&index=2',
    summary:
      'Engagement discipline is the skill of knowing when a fight is actually ready to be played instead of forcing damage, peeks, dives, or ego pressure before your team has a real window.',
    poolJob:
      'Use the setup phase to get healthy, find your angle, read resources, and wait for the opening that turns positioning into real pressure.',
    pickWhen:
      'Use this guide when you die before fights start, poke from open space, chase damage numbers, or dive before your frontline and teammates have created a safe timing window.',
    sections: [
      {
        title: 'Early deaths are usually pacing errors',
        points: [
          'The guide opens with a common Marvel Rivals problem: spawn doors open, players walk out, and someone dies within the first 10 seconds before the fight even really starts.',
          'Those deaths usually are not caused by a coordinated ultimate or a five-player collapse.',
          'They often happen because someone walked somewhere they had no business being and then explained it as looking, poking, or getting hit by a lucky shot.',
          'As players climb, those excuses matter less because early deaths are usually bad pacing, not bad luck.',
          'The major difference between many lower-elo and higher-elo players is not just mechanics. It is engagement discipline.',
          'Engagement discipline means understanding when a fight is actually ready to be played.',
          'A lot of players see an enemy and immediately feel obligated to shoot, peek, push, dive, or force value.',
          'Sometimes the best play is to do nothing yet because the fight has not reached the timing where your action will actually matter.',
        ],
      },
      {
        title: 'Do not treat setup like the fight',
        points: [
          'The biggest mistake in the guide is treating the setup phase like the actual fight.',
          'Players leave spawn, walk straight down main, shoot the first visible target, and hope something happens.',
          'That is not pressure. That is exposure.',
          'Every pointless peek gives the enemy a free opportunity to punish you.',
          'Even if you survive, you may force your Strategists to heal unnecessary damage or force your Vanguard to spend protection resources early.',
          'That damages your team economy and tempo because teammates must clean up a mistake that did not need to happen.',
          'Many players think they are helping because they see damage numbers.',
          'Damage numbers do not automatically equal value.',
          'Standing in the open shooting a tank who is being healed through everything usually does not accomplish much.',
          'In that situation, you are mostly making yourself easier to punish.',
        ],
      },
      {
        title: 'Split every fight into setup and execution',
        points: [
          'The guide recommends separating every fight into two parts: setup and execution.',
          'During setup, your goal is not to farm damage.',
          'Your setup goals are to get ready, find your angle, identify targets, see where teammates are positioned, and understand what resources both teams have available.',
          'The most important setup rule is to keep your health bar full.',
          'When the actual fight starts, you want to enter it at your strongest instead of already damaged, down cooldowns, or out of position.',
          'Higher-elo players are patient in this phase.',
          'They sit behind cover, hold off-angles, wait for information, wait for cooldowns to be burned, and wait for someone to create an opening.',
          'Just because you can shoot does not mean you should.',
          'Just because you can dive in and brawl does not mean you should.',
          'Waiting five seconds can create a better opportunity than forcing something immediately.',
        ],
      },
      {
        title: 'Cover is your default position',
        points: [
          'The first practical fix is to get comfortable using cover.',
          'Cover should not be something you run to only after you are already losing the trade.',
          'Cover should be your default starting position.',
          'When you take an angle, know where you will retreat if the trade goes wrong.',
          'Know where the nearest health pack is.',
          'Know where your nearest Strategist is.',
          'The goal is not to force a fight every time you see somebody.',
          'The goal is to create pressure while still having an escape available.',
          'Good pressure is repeatable because you can survive, reset, and pressure again.',
          'Bad pressure leaves you exposed and forces your team to spend resources fixing your positioning.',
        ],
      },
      {
        title: 'Ask who can actually die',
        points: [
          'The guide says to stop asking, "Who can I shoot?" and start asking, "Who can I actually kill?"',
          'Those are completely different questions.',
          'Seeing a target does not mean the target is vulnerable.',
          'Before committing, check whether the target still has cooldowns.',
          'Check whether they are being healed.',
          'Check whether they are playing behind cover.',
          'Check whether they can simply walk away.',
          'If any of those answers are yes, it is often better to wait.',
          'Engagement discipline is the discipline of waiting for the correct window.',
          'A window might be an enemy overextending, a support using an important cooldown, a tank turning the wrong way, or someone walking too far from their team.',
          'Players who climb consistently tend to recognize those windows quickly.',
          'They are not randomly forcing opportunities. They are identifying and enforcing real ones.',
        ],
      },
      {
        title: 'Let the frontline open the fight',
        points: [
          'The guide specifically calls out Duelist impatience: it is hard to wait, but squishy characters especially need that patience.',
          'You do not need to be the first person seen every fight.',
          'Let your Vanguard take space first.',
          'Let the frontline draw attention.',
          'Let them soak damage and force enemy resources.',
          'When the enemy team starts looking somewhere else, that is your signal.',
          'That is when the fight actually opens.',
          'That is when positioning becomes pressure.',
          'That is when pressure turns into kills.',
          'That is when the execution phase begins and your damage can push the fight forward instead of exposing you early.',
        ],
      },
      {
        title: 'Execution starts after the window appears',
        points: [
          'The execution phase is where you finally commit your damage, dive, off-angle, or brawl timing.',
          'You execute after your team has space, enemies have spent resources, or a vulnerable target is actually killable.',
          'Your job is to convert the opening instead of trying to create every opening by yourself from a bad position.',
          'If the enemy is looking away, a support cooldown is gone, or a target is separated, your pressure has a much higher chance of becoming a final blow.',
          'If none of those conditions exist, forcing the fight early usually creates an unforced mistake.',
          'Many ranked games are decided by those unforced mistakes.',
          'Rushing your engagement is one of the biggest ones.',
          'Slow down, be patient, wait for your window, and stop forcing fights before they are ready to happen.',
        ],
      },
      {
        title: 'Quick discipline checklist',
        points: [
          'Before peeking, ask whether the fight is still in setup or has actually reached execution.',
          'Start from cover and keep a retreat route available.',
          'Enter the real fight with full health whenever possible.',
          'Track where your teammates are before committing.',
          'Look for cooldowns, overextensions, isolated targets, and enemies facing the wrong direction.',
          'Do not mistake safe-looking damage numbers for real value.',
          'Let your Vanguard or frontline pressure create attention before you expose yourself.',
          'When the window appears, execute decisively instead of hesitating.',
          'When the window is not there, wait, reposition, and preserve your resources.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'season-8-5-discipline',
    heroName: 'Season 8.5 Discipline',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/phoenix.png',
    sourceLabel: 'The Real Reason You Are Losing in Season 8.5 video guide',
    sourceUrl: 'https://www.youtube.com/watch?v=J2Y3Oqq7RYc&list=PL5TQ7tktRWOC3sAGM2Fg-TdOQTDSxMHd6',
    summary:
      'Season 8.5 rewards fundamentals harder: positioning, timing, resource management, sightline respect, and patience matter more than forcing fights or blaming the newest strong hero.',
    poolJob:
      'Use discipline to survive poke pressure, avoid macro mistakes, and enter fights with health, cooldowns, and positioning intact.',
    pickWhen:
      'Use this guide when poke comps feel impossible, Cyclops or long-range heroes punish every rotation, or your team loses fights before anyone even dies.',
    sections: [
      {
        title: 'Season 8.5 punishes macro mistakes',
        points: [
          'The guide argues that many players are looking at Season 8.5 the wrong way by focusing only on whether heroes like Cyclops or Black Cat are broken, S-tier, or weak.',
          'The bigger story is that discipline matters again.',
          'Positioning, timing, resource management, and understanding when to engage all matter more in this patch.',
          'Players who rely on forcing every fight are starting to feel punished.',
          'The patch punishes not only mechanical mistakes, but also macro mistakes.',
          'Examples include taking one extra peek, walking through one bad angle, chasing one kill too far, or using one cooldown too early.',
          'The players climbing are not always the players with the craziest mechanics.',
          'The players climbing are often the ones making the fewest mistakes.',
        ],
      },
      {
        title: 'Cyclops punishes bad habits',
        points: [
          'The guide says the most important thing about Cyclops is not simply his damage. It is what he punishes.',
          'Cyclops punishes players who stand in places they should not stand.',
          'He punishes wide peeks, open sightline rotations, and staying visible longer than necessary.',
          'Before this patch, players could sometimes get away with those habits.',
          'Against Cyclops, disrespecting an angle, rotating carelessly through open space, or staying visible too long usually means taking damage.',
          'The guide frames that as healthy because positioning should matter.',
          'Players with strong fundamentals do not struggle against him as much because they already respect danger.',
          'Players with sloppy positioning can feel like he is impossible because he is exposing problems they already had.',
        ],
      },
      {
        title: 'Position relative to danger',
        points: [
          'Positioning is not only where you are standing.',
          'Positioning is where you are standing relative to danger.',
          'Ask whether you can break line of sight from your current position.',
          'Ask whether you can retreat if the enemy looks at you.',
          'Ask whether you can reposition without crossing a lethal sightline.',
          'Ask whether you can survive if multiple enemies suddenly turn toward you.',
          'Those questions matter more than the raw location you are occupying.',
          'Cyclops forces players to answer those questions more honestly.',
        ],
      },
      {
        title: 'Adjust to the enemy composition',
        points: [
          'The guide warns that players often move the exact same way no matter what they are playing against.',
          'When Cyclops appears on the enemy team, your movement around the map should change.',
          'Ask where Cyclops is positioned and what angle he controls.',
          'Ask whether he can see your rotation.',
          'Ask how many enemies can actually shoot you if you step out.',
          'Higher-level players constantly adjust to the lobby instead of only playing their own character plan.',
          'If Phoenix controls an angle, they respect it.',
          'If Hela controls a sightline, they respect it.',
          'If Cyclops watches a rotation, they respect it.',
          'That respect is not fear. It is awareness.',
        ],
      },
      {
        title: 'Poke comps win with pressure',
        points: [
          'The biggest Season 8.5 story in the guide is how much poke is showing up.',
          'Phoenix, Hela, Cyclops, and certain support compositions make the game feel more pressure-oriented.',
          'A lot of players misunderstand poke because they think its value is only damage.',
          'The guide says poke is really about pressure.',
          'A good poke composition does not need to instantly kill you.',
          'It only needs to make every decision harder.',
          'Every angle, rotation, and mistake becomes dangerous.',
          'Those mistakes stack until your team loses health, supports burn cooldowns, tanks lose resources, and your team gets forced into awkward positions.',
          'That is why you can feel like you are losing before the fight has actually started.',
        ],
      },
      {
        title: 'Poke is happy winning slowly',
        points: [
          'Poke compositions do not need to win fights quickly.',
          'They are comfortable winning slowly by applying pressure until someone cracks.',
          'Dive compositions usually want a specific moment: an isolated target, a missing cooldown, or a clean jump target.',
          'Poke compositions can sit in neutral and keep applying pressure until a support uses a cooldown early, a tank spends resources before taking space, or a Duelist gets impatient.',
          'The longer neutral lasts, the more chances there are for small mistakes to happen.',
          'By the time the fight starts, a strong poke team may have already won half of it.',
          'This is why patience is so important against poke.',
          'Just because someone pressures you does not mean you have to respond immediately.',
        ],
      },
      {
        title: 'Do not fight poke on its terms',
        points: [
          'The first bad habit to break is fighting a poke composition on its own terms.',
          'Do not walk straight down main, take unnecessary damage, burn resources, force a bad fight, and then wonder why the enemy team feels impossible to beat.',
          'Respect sightlines first.',
          'Not every angle needs to be challenged immediately.',
          'Sometimes the correct play is rotating.',
          'Sometimes the correct play is waiting.',
          'Sometimes the correct play is doing nothing for five seconds.',
          'That may feel boring, but discipline often looks boring before it wins fights.',
        ],
      },
      {
        title: 'Health is a resource',
        points: [
          'The guide emphasizes that health is a resource.',
          'The fight starts long before the first eliminations happen.',
          'If you enter every fight at half health because you could not stop peeking, you are making the game much harder than necessary.',
          'Supports become more important in a poke-heavy meta because they keep fights stable.',
          'White Fox gains value because she can support off-angles and make poke heroes harder to isolate.',
          'Luna gains value because she can contribute meaningful ranged damage while keeping the team topped up.',
          'Supports who can sustain, apply pressure, and move well become extremely valuable.',
          'Tanks also feel the patch strongly because taking space is not as simple as walking forward anymore.',
        ],
      },
      {
        title: 'Stop forcing every window',
        points: [
          'The final lesson is to stop forcing.',
          'Not every target is your target.',
          'Not every window is your window.',
          'Not every fight is your fight.',
          'The best players are not constantly forcing action.',
          'They wait for the right opportunity, then capitalize instantly when it appears.',
          'Season 8.5 did not create poor positioning, poor timing, poor resource management, or poor engagement discipline.',
          'It is simply punishing those problems harder.',
          'Metas change, heroes rise and fall, but strong fundamentals survive every patch.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'presence-pressure',
    heroName: 'Presence Pressure',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/black-cat.png',
    sourceLabel: 'Most Overlooked Skill short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=9RJ9VfZv8EY&list=PL5TQ7tktRWOC3sAGM2Fg-TdOQTDSxMHd6',
    summary:
      'Presence pressure is the value you create simply by staying alive on an angle or flank long enough that the enemy must respect you.',
    poolJob:
      'Stay alive, hold threatening space, force attention, reset when needed, and re-enter before the enemy can ignore your pressure.',
    pickWhen:
      'Use this quick guide when you measure value only by kills, die for low-value trades, or forget that staying alive can carry a fight by itself.',
    sections: [
      {
        title: 'Presence creates value',
        points: [
          'The short guide argues that value does not only come from kills.',
          'Your presence alone can create pressure.',
          'If you hold an angle, the enemy has to respect it.',
          'If you threaten a flank, the enemy has to respect it.',
          'If you are alive, the enemy has to account for you.',
          'The moment you die, they do not have to think about you anymore.',
          'This is why survival discipline matters so much.',
        ],
      },
      {
        title: 'Survive, reset, and re-enter',
        points: [
          'Good players will spend resources to survive instead of dying for a fragile play.',
          'They disengage when the fight turns bad.',
          'They reset instead of continuing a losing trade.',
          'They grab health packs when that is the fastest safe recovery path.',
          'They re-enter later with cooldowns and health restored.',
          'Cooldowns come back faster than dying and walking back from spawn.',
          'The art of staying alive is one of the ways you carry games without always needing the final blow.',
        ],
      },
      {
        title: 'Quick pressure checklist',
        points: [
          'Before committing, ask whether your presence is already forcing respect.',
          'Do not trade your life if simply staying alive keeps an angle closed.',
          'Use disengage tools before the enemy turns your pressure into a death.',
          'Reset through cover, a health pack, or your Strategists.',
          'Re-enter once cooldowns return and the enemy has to account for you again.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'duelist-pressure-over-damage',
    heroName: 'Duelist Pressure Over Damage',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/psylocke.png',
    sourceLabel: 'Stop Chasing Damage duelist guide',
    sourceUrl: 'https://www.youtube.com/watch?v=kPnMQTQuEpc&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
    summary:
      'A Duelist wins by creating pressure, splitting attention, forcing resources, and punishing mistakes, not by farming scoreboard damage into the tank.',
    poolJob:
      'Attack from useful angles, make supports and DPS react to you, then reset before your pressure turns into a death.',
    pickWhen:
      'Use this guide when you have high damage but low final hits, spend fights shooting tanks, or struggle to turn pressure into space and picks.',
    sections: [
      {
        title: 'Damage is not the whole job',
        points: [
          'The guide argues that Duelists are not valuable only because they deal damage.',
          'A Duelist should apply pressure past the tank and disrupt the flow of the fight.',
          'High damage numbers can still lose games if they do not control space, force attention, or create picks.',
          'Pressure means forcing the enemy team to deal with you.',
          'When pressure is real, supports turn around, tanks lose space, DPS lose off-angles, and the fight starts to fracture.',
          'Sometimes the value is not a kill. Sometimes it is forcing ultimates, cooldowns, healing resources, or attention away from your team.',
        ],
      },
      {
        title: 'Why damage stats lie',
        points: [
          'Shooting the tank all game can create impressive damage stats while changing very little about the fight.',
          'Predictable damage into a healed tank is often easy for the enemy to absorb.',
          'There is a time to shoot tanks, but if nobody is moving and the fight is stuck on main, you usually need to disrupt somewhere else.',
          'Pressure from an off-angle forces movement because enemies feel threatened from more than one direction.',
          'When enemies move, backpedal, or turn around, they are more likely to make mistakes your team can punish.',
          'Final blows and fight wins come from making the enemy uncomfortable, not from damage padding.',
        ],
      },
      {
        title: 'Off-angles create the pressure',
        points: [
          'The easiest Duelist pressure often comes from side angles, high ground, or the enemy backline.',
          'Instead of stacking with your whole team, attack from a different direction so the enemy has two problems at once.',
          'If they ignore you, you may get free kills.',
          'If they turn toward you, your team gets attention value and more room to play.',
          'Off-angles work because most players cannot track every direction during a main fight.',
          'The timing still matters: if someone is already contesting you, reset instead of building habits around lucky escapes.',
        ],
      },
      {
        title: 'Pressure needs life discipline',
        points: [
          'When taking disruptive angles, you must still play your life.',
          'Know where health packs are before you enter.',
          'Have an escape plan every time you pressure an angle.',
          'If a defender contests you or the situation stops being favorable, reset and re-enter later.',
          'Good Duelists wait for chaos before committing because divided enemy attention makes pressure safer and more lethal.',
          'Sometimes you only test an angle, force a reaction, and leave.',
          'Sometimes the enemy team is scattered enough that you can hard commit.',
        ],
      },
      {
        title: 'Main pressure still counts',
        points: [
          'The lesson is not that every Duelist must flank every fight.',
          'Some Duelists can play main well and create pressure with their team.',
          'Even from main, the job is not mindless tank farming.',
          'The job is finding the right targets, disrupting the frontline, punishing exposed squishies, and helping space move forward.',
          'Whether you flank, off-angle, play near your tank, or push main, the goal stays the same: create pressure, force attention, and punish mistakes.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'duelist-disengage-discipline',
    heroName: 'Duelist Disengage Discipline',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/black-cat.png',
    sourceLabel: 'Stop Forcing Fights duelist guide',
    sourceUrl: 'https://www.youtube.com/watch?v=GY37xZLPkC8&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
    summary:
      'Disengage discipline is knowing when a Duelist fight has stopped being favorable and resetting before a good play turns into a death.',
    poolJob:
      'Evaluate fights in real time, leave before pressure overwhelms you, use cover and health packs, then re-enter from a better position.',
    pickWhen:
      'Use this guide when you secure one pick and die chasing the second, burn ultimates to survive greed, or stay in fights a few seconds too long.',
    sections: [
      {
        title: 'Most Duelist deaths are overstays',
        points: [
          'The guide says many Duelist deaths are not about mechanics. They happen because players do not know when to leave.',
          'Players keep fighting because they assume someone will die, then they become the player who dies.',
          'A fight can start well and still flip against you.',
          'Once the fight flips, forcing more value can turn a good play into a lost trade.',
          'Overextending by only a little can be enough for the enemy to punish you.',
          'Good players keep evaluating whether the current fight is still good for them.',
        ],
      },
      {
        title: 'Signs it is time to leave',
        points: [
          'Leave if the kill is not guaranteed and you are risking your life to finish it.',
          'Leave when too much attention is on you and multiple enemies are shooting you at once.',
          'Leave when unexpected threats appear, including cooldowns, abilities, ultimates, or a defender getting the jump on you.',
          'If three people are focused on you, the fight is probably no longer favorable.',
          'Sometimes the strongest outplay is already being out of the way.',
          'You will still die sometimes, but the goal is to reduce preventable deaths.',
        ],
      },
      {
        title: 'Disengage does not mean run forever',
        points: [
          'Disengaging means resetting the fight, not abandoning all pressure.',
          'Health packs let Duelists recover without forcing supports to shift focus.',
          'Every Duelist who flanks or takes off-angles should learn health pack locations.',
          'Natural cover is another reset tool because breaking line of sight for a few seconds can remove pressure.',
          'Cover is especially important for characters without strong mobility.',
          'Abilities help, but positioning and awareness should come first. Mobility is the emergency card, not the whole plan.',
        ],
      },
      {
        title: 'Reset and re-enter',
        points: [
          'A good disengage gives you a better entry into the same fight.',
          'Back up, stabilize, and return once the timing improves.',
          'Surviving keeps pressure on the map and gives you another chance to create value.',
          'Some fights require multiple micro-disengages: reset position, avoid an ability, then re-enter when the timing works.',
          'Great Duelists are not only good at fighting. They are good at knowing when the fight is over for them.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'duelist-target-priority',
    heroName: 'Duelist Target Priority',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/star-lord.png',
    sourceLabel: 'Target Priority Explained duelist guide',
    sourceUrl: 'https://www.youtube.com/watch?v=zuvJYHK2rB0&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
    summary:
      'Target priority is not a fixed rule like always shooting supports. It is the real-time habit of solving the biggest fight problem you can actually reach.',
    poolJob:
      'Scan the fight, identify the current problem, decide whether you can reach it, and keep getting value while waiting for the best target to open.',
    pickWhen:
      'Use this guide when you tunnel one target, ignore the hero disrupting your team, or keep shooting what is visible instead of what is winning the fight.',
    sections: [
      {
        title: 'Priority changes mid-fight',
        points: [
          'The guide says your target priority is often not wrong. It is outdated because the fight changed.',
          'High-elo Duelists are not locked onto one target all fight.',
          'They adapt in real time as the fight changes.',
          'Target priority means choosing who gives your role the most value in that moment.',
          'It is not always supports, not always tanks, and not always the Duelist pressuring your team.',
          'The correct target is whatever is stopping your team from winning the fight right now.',
        ],
      },
      {
        title: 'Shoot the problem, not just the visible target',
        points: [
          'A major mistake is shooting what is directly in front of you instead of what is causing the problem.',
          'If a tank is forward but cannot keep themselves alive without supports, the supports may become the priority.',
          'If a flanker is living in your backline, that flanker may become the priority.',
          'If a Duelist is uncontested and receiving constant healing, solving that support line may matter more than shooting the tank.',
          'If an enemy tank is taking too much space and your team cannot move, that tank may become the immediate problem.',
        ],
      },
      {
        title: 'Do not force priority through bad timing',
        points: [
          'Knowing the priority does not mean you can force it immediately.',
          'If someone peels you or contests your angle, reset and come back when the opportunity appears.',
          'You can keep a priority in mind while temporarily fighting a different target.',
          'Sometimes a teammate ultimate breaks enemy space and suddenly gives you access to a backline target you could not reach before.',
          'Sometimes the best value is cycling through whoever is actually hittable until your preferred target appears again.',
          'Strong Duelists stay locked onto the fight itself, not a single target name.',
        ],
      },
      {
        title: 'Peel can be the priority',
        points: [
          'Sometimes the biggest problem is not in the enemy backline. It is on your supports.',
          'If an enemy dives your Strategists, peeling them can become the correct priority.',
          'The guide frames target priority as solving the problem in front of your team.',
          'You may not get a flashy kill, but protecting the support line can keep the fight playable.',
          'If the situation turns unfavorable while peeling, reset instead of feeding into the same problem.',
        ],
      },
      {
        title: 'Three questions for every fight',
        points: [
          'Ask: what is the biggest problem right now?',
          'Ask: can I actually reach that problem safely?',
          'Ask: if I cannot reach it, what target gives me the most value instead?',
          'Target priority is developed through repetition until the game starts to slow down.',
          'The goal is to scan, adapt, and react in real time instead of memorizing one static target order.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'duelist-off-angle-short',
    heroName: 'Duelist Off-Angles',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/psylocke.png',
    sourceLabel: 'Duelist Off Angles short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=LAWuwOuRM5E&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
    summary:
      'Off-angles let a Duelist attack from a second direction, split attention, and create the chaos that turns pressure into mistakes.',
    poolJob:
      'Take side, high-ground, or backline angles while keeping a health pack route and escape plan ready.',
    pickWhen:
      'Use this quick guide when you stack behind your tank too often or need a simple rule for creating Duelist pressure.',
    sections: [
      {
        title: 'Why off-angles work',
        points: [
          'Off-angles make the enemy fight your team in front while also reacting to you from the side, high ground, or backline.',
          'If nobody contests you, you may get free kills.',
          'If they do contest you, you still pull attention away from the main fight.',
          'Attention split creates hesitation, missed reactions, and positioning mistakes.',
        ],
      },
      {
        title: 'Play your life on the angle',
        points: [
          'Taking an off-angle does not mean feeding.',
          'Know the nearest health pack before committing.',
          'Have an escape plan every time you enter.',
          'If the enemy starts collapsing on you, reset and keep the pressure available for the next window.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'dps-pressure-short',
    heroName: 'DPS Pressure Over Damage',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/hawkeye.png',
    sourceLabel: 'DPS Pressure Over Damage short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=qJhxR9jZaBY&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
    summary:
      'Predictable damage is easy to heal. Real DPS pressure comes from angles that force cooldowns, attention, resources, and mistakes.',
    poolJob:
      'Create a second threat, force enemy reactions, then reset before greed gives the enemy a trade.',
    pickWhen:
      'Use this quick guide when you are farming damage from main instead of forcing resources from better angles.',
    sections: [
      {
        title: 'Predictable damage is easy to heal',
        points: [
          'Standing behind your tank all game makes your damage predictable.',
          'Predictable damage is easier for supports to heal through.',
          'DPS pressure is not only about raw numbers. It is about making enemy decisions harder.',
          'An off-angle can force support abilities, attention, ultimates, and cooldowns even without a kill.',
        ],
      },
      {
        title: 'Take the value and reset',
        points: [
          'The guide warns that greed kills more DPS players than the enemy team does.',
          'Take the angle, force the cooldowns, and reset.',
          'If kills appear during that pressure, take them, but do not give yourself up for extra damage.',
          'Grab health packs and re-enter when a new opportunity appears.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'duelist-disengage-short',
    heroName: 'Duelist Reset Rules',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/black-cat.png',
    sourceLabel: 'Duelist Disengaging short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=W6uvOtZJK-I&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
    summary:
      'Duelists should constantly ask whether the fight is still theirs. If the answer changes, reset instead of forcing value.',
    poolJob:
      'Abandon risky kills, grab health packs, use cover, and re-enter fights on your own terms.',
    pickWhen:
      'Use this quick guide when you need a simple reminder that disengaging is a reset, not a failure.',
    sections: [
      {
        title: 'Leave when the fight flips',
        points: [
          'If the fight stops being favorable, the Duelist job is to reset.',
          'A low enemy is not always worth chasing if you can die too.',
          'Getting one kill does not mean you should overstay.',
          'Sometimes the smartest play is abandoning the fight entirely because the cards are no longer in your favor.',
        ],
      },
      {
        title: 'Health packs are your third support',
        points: [
          'Health packs let you reset without draining your Strategists.',
          'Learn health pack routes on maps where you flank or off-angle.',
          'Disengaging can mean backing up briefly, recovering, and re-entering from a stronger position.',
          'The point is to take the next fight on your terms.',
        ],
      },
    ],
    ultimates: [],
  },
  {
    heroId: 'target-priority-short',
    heroName: 'Target Priority Quick Guide',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/star-lord.png',
    sourceLabel: 'Duelist Target Priority short guide',
    sourceUrl: 'https://www.youtube.com/watch?v=Ki4D-8EAUps&list=PL5TQ7tktRWOAakGzPXBwS7Vwjs9bSIYLt',
    summary:
      'Target priority changes mid-fight. The right target is the one solving the current problem, not always the one you planned to shoot.',
    poolJob:
      'Change angles, identify the problem, shoot what creates value, and keep cycling targets as the fight evolves.',
    pickWhen:
      'Use this quick guide when you tunnel one target or keep shooting the tank while the real problem stays untouched.',
    sections: [
      {
        title: 'Priority is not fixed',
        points: [
          'If shooting the tank is not moving the fight, change your angle and find the target that matters.',
          'A support may become the priority if they are keeping the frontline alive.',
          'A backline DPS may become the priority if they are controlling your team.',
          'Sometimes whoever falls into your line of sight is the right temporary target because they are available now.',
        ],
      },
      {
        title: 'Solve the fight in front of you',
        points: [
          'The guide summarizes target priority as solving the problem in front of you.',
          'Do not chase a theoretical perfect target if the fight gives you a better immediate option.',
          'Recognize the shift mid-fight and act before the opportunity disappears.',
        ],
      },
    ],
    ultimates: [],
  },
];
