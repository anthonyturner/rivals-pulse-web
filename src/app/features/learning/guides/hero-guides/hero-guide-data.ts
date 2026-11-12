import type { HeroGuide } from './hero-guide.types.ts';
export type { GuideArticleSource, HeroGuide, HeroGuideExample, HeroGuideSection, HeroUltimateGuide } from './hero-guide.types.ts';

export const HERO_GUIDES: HeroGuide[] = [
  {
    heroId: "doctor-strange",
    heroName: "Doctor Strange",
    category: "hero",
    role: "Vanguard",
    image: "/images/heroes/doctor-strange.png",
    sourceLabel: "Infinitea - How To Play Like The Rank One Doctor Strange In Marvel Rivals",
    sourceUrl: "https://www.youtube.com/watch?v=SWomAJspcoM&t=189s",
    summary: "Doctor Strange creates room for his team by making the enemy work for every step. This lesson follows Infinitea's gameplay review to connect positioning, frontline handoffs and backline protection with the objective decisions they serve.",
    poolJob: "Hold ground your teammates can use while keeping cover, healing sightlines and defensive resources available for the next exchange.",
    pickWhen: "Read this when you survive on the frontline but struggle to judge when to advance, protect a teammate or give ground. The goal is a repeatable decision process, not copying every aggressive play in the review.",
    sections: [
      {
        title: "Position where help can reach you",
        paragraphs: [
          "Start with the relationship between three positions: yours, your supports' and the enemy's. Your Strategists need a clear line to heal you, while the enemy should have as few clean angles into you as possible. In the discussion beginning at 0:20, Infinitea treats those sightlines as the foundation of tank positioning. A spot that blocks friendly healing while exposing you to several enemies asks your team to solve a problem you created.",
          "Cover reduces that demand before a shield or a heal is spent. Use a wall when you can; when you cannot, check whether the payload protects the direction that matters. Stand in front of teammates when your shield is meant to cover them. If you take a separate angle instead, avoid lining everyone up behind you so a missed shot into the tank still finds the backline.",
          "The consequence reaches beyond your own health bar. As the review explains on attack at 12:15, constant unnecessary damage keeps your supports busy healing you. That leaves less attention for a threatened teammate, less damage into the enemy and fewer opportunities to use utility aggressively. Taking space efficiently means asking for only the healing needed to hold it."
        ]
      },
      {
        title: "Give ground before you run out of choices",
        paragraphs: [
          "A first allied death changes the fight even when your own health looks comfortable. At 1:09, Strange backs away instead of treating his current position as something he must defend at any cost. The retreat preserves room for the team to recover and makes the attackers choose between chasing and keeping players on the payload. Watch what they actually commit rather than assuming every retreat gives away the same amount of progress.",
          "Space has a limit. If there is still room to recover together, spending some of it is often better than losing another player. Once leaving would immediately surrender the objective, a difficult contest may be necessary. After a lost fight, make the escape decision promptly: leave with teammates when survival is realistic, and avoid a late isolated death that postpones the next full regroup."
        ]
      },
      {
        title: "Hand off the frontline, then take a short angle",
        paragraphs: [
          "Think of the frontline as a responsibility you can share rather than a place one tank owns for the whole fight. Around 3:06, Magneto has spent protection while Strange has recovered health and some shield. Strange can step in front and absorb attention while Magneto backs away. The useful information is not simply that your own abilities are ready; it is that your teammate has a reason to stop taking pressure.",
          "That same resource check determines whether an angle is available. In the sequence discussed at 9:28, Strange has damage prepared, defensive tools available and Magneto holding the point. A brief move toward the backline can create value without leaving the objective unattended. Check the side routes, make the enemy respect them and return before a short pressure play becomes an unsupported chase.",
          "The attack-side flank discussed at 12:59 is a warning about that limit. Infinitea knows his supports are across the fight and accepts responsibility if the attempt fails. Its success does not make that position a default. Close-range pressure from The Thing or Thor also changes what Strange can safely contest. Reassess the route, range and exit instead of assuming the same duel will remain favorable."
        ]
      },
      {
        title: "Turn back without surrendering the objective",
        paragraphs: [
          "Peeling means turning to protect a teammate under attack. When Venom reaches your backline, the immediate question is whether you can help and still meet the objective deadline. The review's situations at 2:29 and 5:20 show why this is a trade rather than an automatic instruction to push or retreat. If you are the only tank keeping the point contested, leaving may lose it before you can return.",
          "Being unable to chase the diver does not make protection impossible. In the sequence at 7:31, blocking the enemy team's follow-up fire limits the damage that can arrive alongside Venom. A shield can also protect teammates from a hook instead of merely saving its owner. Check the angles into the backline as well as the enemy directly in front of you.",
          "Keep making that check during friendly support ultimates. They create room to act, but they do not remove every threat behind you. Around 10:55, Strange protects a teammate from Winter Soldier and denies the follow-up. The lesson is to spend the temporary safety on the problem that matters now, even when that means turning away from an aggressive plan."
        ]
      },
      {
        title: "Plan the response to your ultimate",
        paragraphs: [
          "Eye of Agamotto is a plan for the next exchange, not just a button to press when charged. In the discussions at 3:58 and 7:52, Infinitea looks at which support still has a defensive ultimate and what would happen after Strange commits. Prepare the approach from cover, identify the answer you want to force and give your team a chance to follow the same play.",
          "Forcing that defensive answer can already be useful. If the team can give ground, stepping away may preserve the advantage for the next attempt. Spending another ultimate to continue through the enemy response is a separate decision, especially when the objective no longer leaves room to retreat. Tell teammates what you intend and ask what defensive abilities they have already drawn out; an opening is easier to use when everyone knows it exists.",
          "The review also shows damage after Strange's ultimate helping build the next one. That makes safe follow-up valuable, but it is not a promise of a fixed amount of charge or permission to chase into a lost fight. Keep the same cover, healing and resource checks after the ultimate that made the approach possible before it."
        ]
      },
      {
        title: "Regroup before the next contest",
        paragraphs: [
          "A stagger is a series of isolated deaths that stops a team from fighting together. The checkpoint discussions at 6:53 and 16:45 show how easily it begins: one player has just respawned, another walks forward and the rest arrive too late to support either. Call for the team to wait before the next entry instead of discovering the problem after another death.",
          "When the enemy supports die late, the same timing works in your favor. Use the temporary advantage together rather than turning it into several separate chases. Strange's portal can help a regrouped team reach a real contest, but it cannot recover a fight that is already over. Judge the remaining time and who is alive before committing the setup."
        ]
      },
      {
        title: "Use a portal to change who can contest",
        paragraphs: [
          "Once your team has an advantage, the next useful action may be to deny an entrance rather than deal more damage. The final sequence beginning at 18:12 turns that idea into an objective play: Strange presses forward far enough to set a portal at the defenders' approach. The portal changes where they arrive, making it harder for them to reach the point together.",
          "This depends on the doorway, destination, alternate routes and remaining contest time. Announce the plan so teammates can protect the setup and maintain the pressure that makes it possible. A portal placed without that ground or protection is a different play, even if the doorway looks similar. The example below explains the decision shown in the review rather than prescribing a portal location for every map."
        ]
      }
    ],
    workedExample: {
      title: "The doorway portal converts an advantage into capture",
      paragraphs: [
        "At 18:12, Infinitea is looking for a way to stop the defenders reaching the objective after his team gains kills. He calls the portal plan, pushes the defenders back from the point and places it across their doorway. That order matters: the team first creates the room that lets Strange set up safely.",
        "The review then checks the play from the defenders' perspective. Approaching players are redirected away from the point or arrive separately, so the remaining defenders cannot restore a coordinated contest. The payoff is objective progress, not a larger damage total. This does not prove the same doorway trick will work elsewhere; without team protection, a suitable exit or a tight contest deadline, the value may disappear."
      ],
      sourceUrl: "https://www.youtube.com/watch?v=SWomAJspcoM&t=1092s"
    },
    practiceFocus: "For your next match, focus on one question before stepping forward: can my supports see me, and who will hold the objective if I leave? Say the answer before taking a new angle. After the match, review one death or failed contest and check whether the answer changed while you kept moving. Keep this as a decision habit; do not judge it only by whether a risky play happened to succeed.",
    ultimates: []
  },
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
        paragraphs: [
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
        paragraphs: [
          'Strategists support the team with healing, utility, damage, and high-impact decisions. Healing matters, but they are not limited to being healbots.',
          'Vanguards survive pressure, contest valuable ground, and let teammates take safer angles. Their job is to create space the team can actually use.',
          'Duelists convert openings into pressure and eliminations. They can threaten isolated targets, backlines, and enemies caught out of position.',
          'Think of a Vanguard as the team’s durable front and a Duelist as its finishing pressure, while Strategists keep the fight workable and create options.',
          'Your role is a starting responsibility, not a script. Watch the current fight and help solve the problem your team actually has.',
        ],
      },
      {
        title: 'Learn heroes, synergies, and matchups',
        paragraphs: [
          'Some hero combinations create team-up benefits, but a hero does not need a synergy to be useful.',
          'Matchups are about tools: which abilities let one hero pressure, escape, deny, or punish another hero.',
          'You do not need to master the entire roster immediately. Playing unfamiliar heroes briefly still teaches you what their cooldowns look like from the other side.',
          'Composition matters, but flexibility matters more than forcing a rigid formula. Adapt to the map, your teammates, and the threats the enemy is actually using.',
          'When an enemy is repeatedly causing trouble, identify the tool enabling them and look for a hero, angle, or teammate response that limits it.',
        ],
      },
      {
        title: 'Choose a main without trapping yourself',
        paragraphs: [
          'Try heroes that look interesting, even if they do not immediately seem like your style. You learn fit by playing, not by guessing from a roster screen.',
          'Build comfort on roughly three or four heroes with different answers to common situations rather than spreading practice across the whole roster.',
          'Keep enough flexibility to handle bans, difficult matchups, and team needs, especially as you move into more competitive games.',
          'Do not let a tier list choose your main. Strength at the highest level can differ from what works for your experience, platform, and current skill.',
          'A hero you enjoy and understand gives you better practice than a supposedly optimal pick you do not know how to play.',
        ],
      },
      {
        title: 'Play modes through their important moments',
        paragraphs: [
          'In Convoy, checkpoint progress changes future spawns and is worth committing resources to. Force defenders away from the objective, then convert the win into movement.',
          'In Domination, the objective matters, but winning the full team fight creates the safest capture time. Do not trade a winnable fight for a few isolated seconds on point.',
          'Health packs, alternative routes, high ground, and destructible cover all change which positions are safe and which escapes are available.',
          'Learn maps with a simple question: where can I recover, rotate, or take a better angle before the next fight starts?',
          'Use the environment intentionally. A route or piece of cover is valuable when it lets your team apply pressure without giving the enemy an easy target.',
        ],
      },
      {
        title: 'Win fights before chasing progress',
        paragraphs: [
          'A team fight is the committed clash where both teams spend abilities and ultimates. Winning it usually creates more objective progress than trickling onto the objective alone.',
          'Stay close enough to support teammates and help focus the same problem. Six separate duels rarely beat coordinated pressure.',
          'If a fight is clearly lost, disengage and regroup. Feeding staggered eliminations gives the enemy more time and resources.',
          'After a win, take the secure progress available: capture, push, establish better positions, and prepare for the enemy return.',
          'Track resources across the fight. Cooldowns and ultimates are shared opportunities; a team that uses them with a plan has a major advantage.',
        ],
      },
      {
        title: 'Improve one repeatable habit at a time',
        paragraphs: [
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
    summary:
      'A Vanguard fundamentals guide about taking turns, holding space, main tank vs off tank jobs, solo tanking, and using ultimates during the fight instead of forcing them as risky openers.',
    poolJob:
      'Hold as much useful space as possible without dying, read whose turn it is, and spend cooldowns when your team can actually follow up.',
    pickWhen:
      'Use this guide when you play Vanguard, fill solo tank, push too far without follow-up, sit cart after won fights, or struggle to understand when you should walk forward or give space.',
    sections: [
      {
        title: 'Tank is a fundamentals role',
        paragraphs: [
          'Vanguard is not only about being durable. The role asks for strong game awareness, map understanding, cooldown discipline, and timing.',
          'A tank player often sees the most information because they are near the front of the fight and can read what is happening in front of and behind them.',
          'Your rank-up path on tank is mostly fundamentals: knowing when to hold, when to give space, when to peel, when to support your team turn, and when to disengage.',
          'The two biggest carry habits are holding as much space as possible and not dying.',
          'You do not need to make every play yourself. You need to create playable fights for the rest of your team.',
        ],
      },
      {
        title: 'Understand turns',
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
          'Whether you should chase an enemy DPS angle depends on your hero range, mobility, and job in the composition.',
          'Magneto can often sit point and shoot because his range lets him influence angles without abandoning main.',
          'Emma Frost can poke some angles with beam, but she should not spend too much time walking away from point if that lets the enemy tank push into her backline.',
          'A low-range frontline tank should not chase every Star-Lord or ranged angle if doing so gives up main control.',
          'Mobile tanks such as Rogue, Hulk, Thor, Captain America, or Venom can contest some side angles more naturally, but they still need an exit plan.',
        ],
      },
      {
        title: 'Off tank job: clear side space',
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
          'When solo tanking with three Duelists, the game puts more playmaking weight on the Duelists and asks you to support their timing.',
          'If your Iron Fist, Spider-Man, Phoenix, or another Duelist commits to a real angle, help by shooting their target, bubbling them if possible, or walking forward enough to make their play safer.',
          'Do not try to create a solo flank play as the only tank if it exposes your supports and abandons point control.',
          'Watch which target your DPS can actually reach. Sometimes your job is to weave shots past the enemy tank and help finish the squishier target your Duelist is pressuring.',
          'If your Duelists are ahead of you and likely die unless you help, the fight may require you to take a little more space and support that play.',
        ],
      },
      {
        title: 'Ultimate timing for tanks',
        paragraphs: [
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
        paragraphs: [
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
    summary:
      'Captain America is a mobile dive Vanguard who wins through pressure, displacement, soft engages, backline disruption, and timely peel instead of sitting main and punching tanks all game.',
    poolJob:
      'Stage around the enemy, force support cooldowns, help friendly divers collapse, intercept flankers when your supports need help, and use Freedom Charge to engage, answer threats, or stall.',
    pickWhen:
      'Pick Captain America when your team can surround the enemy with dive pressure, when you need a Vanguard who can harass poke/backline heroes, or when your supports need a mobile tank who can peel without becoming stationary.',
    sections: [
      {
        title: "General philosophy: do not sit main",
        paragraphs: [
          "Captain America makes a fight easier by changing where the enemy has to look. The source guide warns against spending the whole match in main, punching the opposing tank: that leaves his mobility and displacement doing very little. Stage around the enemy instead, force attention away from the frontline and decide whether the opening calls for a kill attempt or another reset.",
          "Choose that job from the team fight rather than from a fixed route. Psylocke, Daredevil, Iron Fist and Black Panther can use help surrounding the backline; if your own supports are struggling, the more useful route may intercept an enemy flanker before the engage lands. Intelligent staging lets Cap move between those responsibilities without becoming a stationary frontline tank."
        ]
      },
      {
        title: "Sentinel Strike: punch into shield pressure",
        paragraphs: [
          "Sentinel Strike turns a close approach into sustained shield pressure. In the source version of the kit, melee punches deal 40 damage and build the charges shown beneath the reticle. Four charges, or punching a target twice, unlock mini shield throws dealing 45 damage per hit. Those throws automatically seek enemies near the crosshair rather than ricocheting like Vibranium Energy Saw.",
          "Their reach is about 25 meters, so treat them as a chase tool after closing distance, not as a long-range poke plan. The guide also notes that aiming a little to the target's right gives more generous homing than aiming to its left. When preparing the sequence, Groot walls, Loki clones and Moon Knight ankhs can build Sentinel Strike charges; inanimate shields such as Emma Frost's cannot."
        ]
      },
      {
        title: "Leading Dash and Super-Soldier Slam",
        paragraphs: [
          "Leading Dash provides the movement that keeps this close-range plan working. The source guide describes a 33% sprint speed bonus without a cooldown or energy meter. Sprinting between mini shield throws helps Cap stay with a retreating target, but rushing the inputs can cancel a throw and lose its damage. Listen for the shield impact before throwing again. Hold or toggle sprint is a comfort choice; getting the pressure-and-reset idea right matters more than small sprint optimizations.",
          "Jumping while sprinting opens Super-Soldier Slam, which deals 30 damage in the source and launches enemies upward. When already close, two punches into a slam set up the mini shield follow-up. When another diver commits first, timing the slam with that entry can help burst a support instead of starting an isolated fight.",
          "The same slam can provide a way out. Its stated 12-second cooldown makes the decision important: using it for a small amount of extra pressure may remove the escape you need a moment later. Plan the exit while you are choosing how to enter."
        ]
      },
      {
        title: "Living Legend: shield for stuns and clutch blocks",
        paragraphs: [
          "Living Legend is protection to spend on a specific danger. It deflects projectiles in random directions, unlike Daredevil-style aimed deflections; melee and beams do not reflect back, although some beam damage can still be blocked. The source gives the shield 350 health and a recovery rate of 50 health per second while put away. Lowering it creates a short lockout, and breaking it creates a longer wait, so repeatedly flashing or exhausting it has a cost.",
          "Use that protection for the moment that would stop your route: a Luna snowball, a Hela stun or another dangerous interruption. It can also cover friendly supports from projectiles and certain ultimate situations, including Iron Man and Magneto. Ordinary poke does not always justify spending it. Better pathing, cover, health packs and support healing can preserve the shield for the stun or clutch block that matters."
        ]
      },
      {
        title: "Liberty Rush: finish or escape, not both",
        paragraphs: [
          "Liberty Rush forces a choice between committing damage and preserving an exit. The source describes a 12-meter charge dealing 30 damage on a 10-second cooldown, usable whether Living Legend is raised, lowered or broken. During the dash, crowd-control immunity can dodge a Luna snowball, Doctor Strange ultimate or even Jeff ultimate timing.",
          "Unlike Psylocke's dash, however, it stops when it hits a target. Do not plan to damage through someone and escape with the same cast. On a hard kill attempt, spend it to finish quickly; on a soft engage meant to draw resources, saving it lets you dodge crowd control and leave after the enemy responds."
        ]
      },
      {
        title: "Vibranium Energy Saw and the core combo",
        paragraphs: [
          "Vibranium Energy Saw supplies the larger shield hit that turns contact into real finishing pressure. It deals 70 damage on the first hit in the guide, then can ricochet up to three times with reduced damage on each bounce. A throw into the ground near a target can still bounce into them, making the legs a more forgiving aim point than insisting on a perfect direct hit.",
          "Timing matters as much as aim. A throw launched too early from a hidden staging position announces the approach and gives supports time to heal the damage; never weaving it in gives away pressure and finishing power. The source combo is sprint, jump, Vibranium Energy Saw, wait, left click, Liberty Rush, then left click. Practice the rhythm in the range before asking a crowded fight to teach it to you.",
          "Use that committed sequence when a friendly diver is ready to help secure the kill. A soft touch has a different purpose: apply shield-throw and slam pressure, read the response and retain Liberty Rush to leave or dodge crowd control. The abilities are straightforward individually, but combining all of them without an intended outcome makes the engage unnecessarily hectic."
        ]
      },
      {
        title: "Freedom Charge: mini support ultimate",
        paragraphs: [
          "Freedom Charge can support an entire team's timing rather than only making Cap harder to kill. The source describes a 30% movement speed bonus, 150 bonus health for Cap on cast and 100 for nearby allies, followed by further bonus health radiating from Cap while it remains active. Start near teammates when possible so the immediate health and the trail or aura can help them through the exchange.",
          "Its three jobs are engaging, answering medium threats and stalling. As an engage, the speed carries Cap and the team into the backline without spending a stronger support ultimate first. As a counter, the durability can answer Star-Lord ultimate, Psylocke or Black Panther pressure, or a backline that urgently needs protection. As a stall, it lets Cap survive and bump enemies around while buying objective time.",
          "Those jobs require noticing allied danger. Consider enabling ally health bars: tanks do not naturally get the same critical-health prompts as supports, yet this ultimate can save teammates like a support tool. Match the cast to what the team needs, and keep the more specific limits in the ultimate plans below in mind."
        ]
      },
      {
        title: "Counters and annoying matchups",
        paragraphs: [
          "Matchups change whether a clean route is available, not just which tank wins a direct trade. The guide argues that skilled use of Liberty Rush and Cap's mobility can avoid key Emma Frost crowd control, so it does not treat her as an automatic hard counter. It calls out Peni Parker and The Thing as more troublesome Vanguard opponents. There is also a coordination problem: teammates expecting a simple Magneto, Emma or Strange front-to-back brawl may not understand what a Cap pick is trying to create.",
          "Several Duelists make staging harder. Winter Soldier can dash into Cap and force a retreat without mobility; Namor's turrets are difficult for Cap to clear alone, although his larger health pool absorbs more than a squishy diver's would. An accurate Punisher can shred Living Legend quickly. Iron Fist and Daredevil can mark or track the approach, removing the freedom to choose a clean angle.",
          "Do not assume Freedom Charge solves those threats by itself. Ultron is singled out as an answer whose pressure can burn through the bonus-health plan. Adapt the route and the purpose of the ultimate rather than spending the same resources into every opposing composition."
        ]
      },
      {
        title: "Synergies: surround and collapse",
        paragraphs: [
          "Look for teammates who can use the attention Cap creates. The source highlights Venom as the strongest tank partner: taking different angles and collapsing onto the same target can force support cooldowns immediately. Adding Angela puts another large health bar into that converging pressure. The Winter Soldier Team-Up lets Bucky reposition to Cap and is useful, but the guide does not make it the central reason to choose him.",
          "Psylocke, Black Panther, Iron Fist and Star-Lord fit the surrounding-backline plan. Human Torch adds a different consequence: Cap's punches can make enemies retreat through Torch's fire zones. On support, Luna Snow is a strong pairing, while Mantis can make an engage more lethal without requiring Cap to overcommit. The shared requirement is follow-up that can arrive when the enemy turns."
        ]
      },
      {
        title: "VOD lesson: force cooldowns before kills",
        paragraphs: [
          "The Paulie VOD review shows why pressure and a finished kill are different outcomes. Cap stages away from main, waits for a friendly Psylocke flank and slams the supports once the backline becomes vulnerable. After a pick or a forced resource, he leaves rather than feeding and returns when another opening develops. The first touch creates conditions for the harder one.",
          "The same review praises clearing room for a flanking Jeff, who can then establish a useful damage-and-healing angle behind the enemy. In chaotic triple-support fights, put out the fire that matters: threaten the right enemy, force support ultimates and use Freedom Charge so your supports can answer second. If a threat to your backline is already too committed or too far gone for you to peel, do not waste the whole window travelling to it; look for an equal or better play against the opposing backline."
        ]
      },
      {
        title: "Soft engage discipline",
        paragraphs: [
          "A soft engage is a limited pressure touch whose purpose is to force a cooldown. The VOD shows Cap reaching supports, drawing Mantis sleep or Luna snowball and using Liberty Rush or disciplined shielding to leave before the punish. Reaching the target does not automatically turn holding primary fire into the correct next action. Read what the defender spends and whether the real kill attempt is ready.",
          "That first response changes the next fight. Sleep, snowball, runes, portals and other support tools that are no longer available make a return entry more dangerous. Even without personally killing the support, Cap can interrupt healing long enough for teammates to win the point or finish the tank. Keep the first touch shallow enough to survive, then let the accumulated pressure produce the opening."
        ]
      }
    ],
    workedExample: {
      title: "A soft touch prepares the Psylocke collapse",
      paragraphs: [
        "In the source's Paulie review, Cap stages away from main and waits until the friendly Psylocke flank is ready before slamming the supports. The teaching decision is the wait: entering alone would spend the same tools without the coordinated backline pressure the example is trying to create.",
        "After a pick or a forced resource, Cap leaves and looks for the next entry rather than trying to turn the first contact into an endless duel. The useful result is either the opening for the collapse or fewer defensive answers for the next touch. If your own supports need peel instead, the same route is not automatically the right job."
      ],
      sourceUrl: "https://www.youtube.com/watch?v=HZrBVN4tuik"
    },
    practiceFocus: "For your next match, name one enemy defensive cooldown you want to force before each soft engage, and keep a way out for its response. Review one entry afterwards: did you leave once the resource was spent, or did you turn a successful pressure touch into an unsupported chase?",
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
    summary:
      'Jubilee is an active brawl and tempo Strategist who leapfrogs charged Blooming Balls with her frontline, detonates them for burst sustain and utility, and chains Sparkle Marks to keep enhanced Energy Plasmoids running.',
    poolJob:
      'Move the team forward one healing zone at a time, maintain the orb-detonation-mark loop, add damage while enhanced, and use Sparking Sprint to preserve momentum or escape danger.',
    pickWhen:
      'Pick Jubilee with a durable, grouped frontline that can occupy her Blooming Balls. Be cautious when your team is built around flyers, flankers, and multiple dive heroes who spread beyond her area healing.',
    sections: [
      {
        title: "Playstyle: leapfrog the frontline",
        paragraphs: [
          "Jubilee advances a grouped team by preparing its next healing position. The guide calls this leapfrog: place Blooming Ball ahead of the Vanguards, let them occupy it, charge and detonate it, then set the next orb farther forward. Each new field marks a piece of ground the team can use, so the healing layout leads the fight instead of trailing behind it.",
          "That requires active sequencing rather than passive healing. Sparking Sprint starts the momentum; Sparkle Marks help carry it forward; the next orb must be ready before the cycle runs out. Grouped brawls reward the work because healing, damage, detonations, allied buffs and enemy debuffs can affect several heroes together. Gaps between those abilities are lost output, not harmless downtime."
        ]
      },
      {
        title: "Blooming Ball: feed the orb correctly",
        paragraphs: [
          "Blooming Ball begins as a smaller healing-and-damage field. As it affects targets or receives Jubilee's fire, it grows in radius and healing output. Fully charging a useful orb therefore improves the area your team can occupy, its sustain and the size of the eventual detonation, while refreshing the orb's remaining lifetime.",
          "Charge through an injured ally inside it whenever possible. Shooting that ally supplies direct healing and orb healing while feeding the field quickly. A healthy ally has no missing health for that route to use. If nobody inside needs healing, activate Sparking Sprint and charge the orb with enhanced Energy Plasmoids; normal primary fire into the orb is the slowest option.",
          "Movement creates another choice. Recall an abandoned orb from within range, even through a wall, to shorten the next cooldown and redeploy ahead of the fight instead of letting it expire behind the team. Recall does not require line of sight, but detonation does. Preserve the detonation angle if you need its burst before relocating."
        ]
      },
      {
        title: "Dazzling Detonation and Sparkle Marks",
        paragraphs: [
          "Detonate the largest practical orb when the resulting reach will matter. Allies receive burst healing, healing over time and movement speed, while enemies take damage, blindness and Vulnerability. The blind can disrupt an ultimate that depends on vision or aim, so the timing can solve a threat that a larger healing number alone would not.",
          "The explosion also marks every affected target with a Sparkle Mark. Shooting a marked ally or enemy consumes that mark and activates enhanced Energy Plasmoids. An allied mark grants bonus health and increases incoming healing, creating Jubilee's strongest single-target stabilization window; an enemy mark adds burst damage. Choose the target that solves the present fight rather than spending the effect on whoever is closest.",
          "Several available marks are a resource to pace. Consume one immediately to start enhanced fire, then use the others before they expire to refresh it. Spending every mark at once loses the extended output that makes the next orb and the next detonation easier to prepare."
        ]
      },
      {
        title: "Core rotation: keep the loop spinning",
        paragraphs: [
          "Begin by placing Blooming Ball just ahead of the frontline so it tracks a Vanguard rather than drifting back toward Jubilee. Activate Sparking Sprint and use enhanced Energy Plasmoids on an injured ally inside the orb, or on the orb itself, until it is fully charged. End Sprint once that job is complete so its resource starts recovering.",
          "Detonate the charged orb and consume one of the new Sparkle Marks to regain enhanced fire. Now place the next Blooming Ball ahead of the team and use that enhanced stream to charge it quickly. While Dazzling Detonation recovers, heal someone who needs it, pressure an enemy or consume another mark, then detonate the prepared orb and continue.",
          "The sequence is orb, sprint, charge, detonate, mark, new orb, charge, repeat. Its purpose is continuity: the first detonation funds enhanced output, and that output prepares the next healing position. Treat it as a loop to maintain through the fight rather than an opener to execute once."
        ]
      },
      {
        title: "Energy Plasmoids: play for the enhanced state",
        paragraphs: [
          "Normal Energy Plasmoids offer modest healing and damage. Sparking Sprint or a consumed Sparkle Mark enables the faster enhanced stream, which consumes no ammo and raises both outputs. The rest of the kit should keep that state available, because its value connects immediate healing and damage with charging the next orb.",
          "Use the stream where it matters now: stabilize a marked ally, fill the next Blooming Ball, help burn the enemy frontline or punish an exposed flyer. Do not reload while enhanced fire is available; keep firing and convert the temporary window into useful work. In a quiet but unsafe moment, maintaining the active orb can still be useful. Once the fight is truly over, recall it and recover resources instead."
        ]
      },
      {
        title: "Sparking Sprint: start, conserve, escape",
        paragraphs: [
          "Sparking Sprint starts the rotation, but it is also Jubilee's escape. Movement speed, enhanced fire and the boosted jump let it solve a charge or positioning problem quickly. Because it uses a resource meter, cancel it when that task is finished instead of letting the full meter drain. Keeping some mobility available helps preserve the next healing cycle.",
          "Use the boosted jump to return to teammates, leave dangerous ground effects or escape an ultimate. Ending Sprint creates a small explosion that knocks nearby enemies back and heals nearby allies, including Jubilee. Remember that exit burst in a close brawl, but do not stay in danger just to force it: surviving to run the full loop is worth more."
        ]
      },
      {
        title: "Positioning and team composition",
        paragraphs: [
          "During a committed brawl, Jubilee belongs near her Vanguards and inside her own Blooming Balls. Sharing the field sustains her while enhanced fire and detonations pressure the same frontline. The Thing, Magneto, Emma Frost and Devil Dinosaur are examples of sturdy anchors that give each orb a reliable center and make the leapfrog plan easy for teammates to follow.",
          "If both tanks dive away, look for the most reliable grounded ally who can temporarily anchor the plan. Flyers, flankers and several dive heroes moving in different directions cannot all occupy one area, and following each of them splits your attention without solving that geometry. Briefly help an outlying ally with enhanced primary fire, then return to the grouped frontline before its sustain collapses."
        ]
      },
      {
        title: "Team-Ups and common mistakes",
        paragraphs: [
          "The source favors The Hood Team-Up because enhanced Energy Plasmoids become hitscan, can critically hit and heal Jubilee through damage. That passive benefit fits a plan built around sustained enhanced-fire uptime: contributing frontline damage also helps her remain in the fight. Blade's Vampiric Kin can grant nearby allies Life Steal and is stronger with Blade, but the guide considers its cooldown-based value less consistent than The Hood's passive.",
          "Most rotation mistakes break that same continuity. Shots into a healthy ally do not charge the orb through healing; an old field left behind cannot support the advancing team; consuming all Sparkle Marks immediately wastes later refreshes. Stay close enough to contribute to the grouped brawl, recall and redeploy abandoned orbs, and resist turning a scattered composition into several disconnected fights."
        ]
      }
    ],
    workedExample: {
      title: "Practice scenario: move the healing zone with the brawl",
      paragraphs: [
        "This is a hypothetical practice situation using the guide's rotation, not an additional event from the source video. Your grounded Vanguard is advancing and has lost health. Place Blooming Ball just ahead of that ally, then use Sparking Sprint and enhanced fire through the injured ally to build the orb while supplying both direct and area healing.",
        "Once charged, stop Sprint to begin recovering its resource, detonate while you still have line of sight and consume one Sparkle Mark. The enhanced stream can now prepare the next orb ahead of the frontline. If the team has moved behind a wall before you can detonate, remember the distinction: detonation needs sight, but an in-range recall can retrieve the abandoned field through the wall."
      ]
    },
    practiceFocus: "For one match, watch the handoff between your first detonation and the next charged orb. Consume one mark to keep enhanced fire running and save later marks for refreshes. Review one low-output gap afterwards: did you run out of marks, drain Sprint unnecessarily or leave the next orb behind the moving fight?",
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
        title: "Actual role: control chaos",
        paragraphs: [
          "Tankpool changes a fight by demanding attention without giving the enemy an easy kill. Fifth's guide does not treat him as a basic tank who stands in main, absorbs every shot and wins by comparing health bars. Pressure, disruption and pacing are the job: push enemies back from useful space, occupy supports so your Duelists can advance or force defensive cooldowns before the real commitment.",
          "Sometimes the useful result is simply living long enough that opponents cannot ignore you. Every resource spent dealing with Tankpool is attention or protection unavailable elsewhere. Keep that pressure mobile by rotating angles, changing stances, backing out and returning when resources recover. Hard-forcing every entry without reading those limits can get him deleted, particularly after nerfs; controlled aggression is what makes the disruption repeatable."
        ]
      },
      {
        title: "Style points and upgrade discipline",
        paragraphs: [
          "Style points supply the upgrades that turn early pressure into a much harder threat to remove. Committing heavily before building them leaves Tankpool short of the sustain and output the plan relies on. Start by poking, pressuring corners and forcing resources while staying alive long enough to gain momentum. A fully upgraded Tankpool demands a different response from one who has not yet built any upgrades.",
          "After a kill, take the picture. Close-range pictures provide more style points than distant ones, but ranged pictures are still useful; the action also supplies an invincibility frame. The source treats skipping that opportunity as giving up both progression and protection.",
          "Fifth recommends Ban Hammer first because its upgraded damage applies even when enemies are not missing. Other choices still depend on the opposing composition. The E upgrade adds attack speed for guns and swords, reduces damage taken by allies and taunts enemies. The dash upgrade gives a second dash, while gun upgrades increase damage. Choose how to build the next pressure cycle rather than treating every upgrade as interchangeable."
        ]
      },
      {
        title: "Master the whole kit: pistols and swords",
        paragraphs: [
          "Pistols and swords have their own cooldowns, so remaining in only one stance leaves useful tools idle. Use pistols at long range, then change to swords when opponents enter the effective close range. Sword pressure is especially useful against targets moving too much for comfortable aim, and a bouncing Tankpool can make the backline's attempts to hit him difficult.",
          "That close threat also moves people. When supports retreat from a dash or sword approach, your Duelists gain space to work even before a kill occurs. Mobility must cover both halves of that exchange: getting in is useful only if you can also leave. If you are stuck, taking too much damage or about to die, use the dash and the rest of the kit together to disengage instead of treating every movement tool as another attack."
        ]
      },
      {
        title: "Dash range and sword combo",
        paragraphs: [
          "The source shows a dash radius of about 10 meters and builds the sword sequence around dash, jump, slash. The jump makes the movement quicker and more fluid than the no-jump version. Practice that order slowly first, then increase the pace until the faster version is natural rather than an unreliable burst of inputs.",
          "Repeat the practice without E and with E, because the attack-speed increase changes the timing and makes the sequence much faster. Sword attacks can critically hit, so aim for the head when the opening permits. A recurring pressure pattern is to place the gun ultimate on a support, then switch to swords to finish more easily; the stance change serves the target and the timing rather than existing as a combo for its own sake."
        ]
      },
      {
        title: "Ban Hammer discipline",
        paragraphs: [
          "Ban Hammer's value depends on understanding what happens before and after its upgrade. In its base form, dropping it on a target grants immediate bonus health and steady healing over time. It also marks the taunted target with an icon. When that target shoots and misses, it immediately takes damage and Tankpool gains further bonus health, punishing a panicked response while making him harder to remove.",
          "The upgrade adds heavy damage over time to those base effects. Damage continues every second even if the target never shoots or misses; misses then make the punishment worse. That is why the source favors it as an early upgrade instead of relying entirely on the opponent to make a mistake.",
          "Apply that threat to the enemy team's lifeline. An upgraded Ban Hammer on a Strategist creates constant pressure, while missed shots or healing attempts add further punishment and disrupt the support's rhythm. The specific ultimate matchups below matter: a target who can completely disengage, such as Jeff going underground and stopping healing, is a different opportunity from an exposed support still trying to sustain the team."
        ]
      },
      {
        title: "Sword ultimate usage",
        paragraphs: [
          "Fifth uses the sword ultimate less often, but gives it a clear purpose when it is chosen: survival. The katana ultimate supplies a movement boost and chunks of healing over time, buying room to stall the point or live through heavy focus fire.",
          "Judge it by the time that survival creates for teammates to recover momentum. Staying alive can keep the objective contestable even when you are not the one producing a clean finish. If you can already disengage safely or the fight is lost without any realistic follow-up, preserving the ultimate may matter more than extending the scene."
        ]
      },
      {
        title: "Plushie Shield discipline",
        paragraphs: [
          "Plushie Shield is a short tactical window, not a replacement for Doctor Strange's shield. The source gives it 300 health at base and 400 after upgrading, with a small increase in radius. A Duelist can destroy it in roughly two seconds, so choosing the job before placing it is more useful than expecting permanent cover.",
          "That job might be denying a large enemy ultimate, crossing a dangerous angle, cutting a support's healing line or briefly blocking damage so Tankpool can reset and receive healing. Healing cannot pass through it, which also creates opportunities to isolate a support inside or outside the shield. Relative position matters in the Doctor Strange interaction: it can block while the relevant players are separated by the shield, but the situation changes if Strange walks inside.",
          "Use the denial deliberately, then move before it falls. The matchup notes distinguish useful targets such as Magneto ultimate from Phoenix ultimate, which cuts through. Dropping it without a particular line-of-sight or ultimate-denial purpose gives away a limited tool without creating the window the team needs."
        ]
      },
      {
        title: "Passive: Healing Factor",
        paragraphs: [
          "Healing Factor can save Tankpool from massive burst or a lethal one-shot ability by granting brief invincibility and rapid healing. It functions like a second life, but the source assigns it a strict 45-second cooldown and notes that you cannot fully choose when it triggers.",
          "Treat that automatic protection as a limit to manage rather than a reason to ignore danger. Avoid spending it early on pressure you could have escaped; living carefully preserves the safety margin for the exchange where leaving is no longer simple."
        ]
      },
      {
        title: "Tank discipline in full fights",
        paragraphs: [
          "The full-fight lesson returns to limits rather than adding another damage sequence. Fifth's example is about surviving and stalling the objective against the odds. Even when the ending is messy, staying alive can be what gives the team one more chance to recover.",
          "That does not require Tankpool to finish every target himself. Build the upgrades, choose the stance, spend protection for a specific window and get out when the pressure has done its work. Keeping the fight alive until teammates can swing it is a real outcome; repeatedly forcing the clean finish at the cost of your life removes it."
        ]
      }
    ],
    workedExample: {
      title: "Practice scenario: build pressure, spend a window, reset",
      paragraphs: [
        "This is a hypothetical practice sequence built from the guide's advice, not an extra event attributed to its video. Before the hard fight, use pistols and corner pressure to build style points rather than committing immediately at zero upgrades. After an available kill, take the picture for progression and the invincibility frame; then reassess whether the next entry is actually ready.",
        "When an exposed support is a viable target, upgraded Ban Hammer can provide pressure that swords follow up at close range. Keep a route out and use a short Plushie Shield window to reset if incoming damage becomes too much. A retreating support and resources forced can still be useful space for your team; do not spend the remaining dash chasing when the next pressure cycle depends on surviving."
      ]
    },
    practiceFocus: "For one match, check your upgrades and exit before each heavy commitment. After pressuring a support, deliberately look for the point where returning to cover would preserve the next cycle. Review one death afterwards and ask whether you forced attention successfully but stayed after your resources were spent.",
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
        paragraphs: [
          'Neutral is everything that happens before and between the obvious fight-swinging moments.',
          'In a fighting game, the flashy parts are combos, powered-up states, and super moves. Neutral is the movement, spacing, jabs, baiting, and waiting that happens before those moments land.',
          'In Marvel Rivals, the flashy parts are big engages, eliminations, and ultimates. Neutral is the quieter phase where both teams are trying to earn the right to make one of those plays.',
          'A neutral state means neither team has a clear advantage yet. Both sides are looking for space, information, cooldowns, damage, and a mistake to punish.',
          'Neutral is not doing nothing. It is the part of the game where players are testing each other without fully committing.',
        ],
      },
      {
        title: 'The fighting game comparison',
        paragraphs: [
          'The transcript uses Tekken as the clean example because fighting games make neutral easier to see.',
          'Players may look like they are only stepping forward, backing away, poking, or waiting, but they are actually controlling space and baiting unsafe actions.',
          'The goal is to make the opponent press the wrong button, move into the wrong range, or spend a powerful option at the wrong time.',
          'Once that mistake happens, the player can cash out with the big combo, powered-up move, or super.',
          'The same principle applies in team games: the big play usually comes after a smaller neutral mistake creates permission to commit.',
        ],
      },
      {
        title: 'Neutral in Marvel Rivals',
        paragraphs: [
          'In Marvel Rivals, neutral is about cooldowns, space control, positioning, baiting, and waiting for the enemy team to push too hard or too little.',
          'Both teams are trying to control the playable area of the map without being punished.',
          'Both teams are tracking resources: their own cooldowns, enemy cooldowns, ultimates, defensive saves, mobility, and healing tools.',
          'A good neutral exchange can be as simple as forcing an enemy to waste a cooldown while your team keeps its resources intact.',
          'A bad neutral exchange is giving the enemy the first opening by walking into danger, spending an important tool for no value, or overextending before your team is ready.',
        ],
      },
      {
        title: 'Why ultimates make neutral feel muddy',
        paragraphs: [
          'The transcript argues that Marvel Rivals does have neutral, but frequent ultimates can make neutral feel less important than it should.',
          'When ultimates happen constantly, matches can feel like both teams are mostly racing to build the next fight-winning button.',
          'Strategist ultimates can erase danger or create huge sustain windows, while Duelist ultimates can delete players quickly.',
          'Because those ultimates counteract and chain into each other, the quieter skill expression before the ultimate phase can feel compressed.',
          'That does not mean neutral is fake. It means you have to recognize the neutral phase before the ultimate lines start stacking.',
        ],
      },
      {
        title: 'What you are looking for',
        paragraphs: [
          'Look for enemy cooldowns spent too early. A movement tool, shield, stun, defensive save, or healing burst can become the signal that your team can press.',
          'Look for enemies who push too far. Overextension is one of the clearest neutral mistakes because it gives your team a target before the enemy is ready to trade back.',
          'Look for enemies who push too little. If the enemy refuses to contest space, your team can move forward, take angles, and start the next fight from a stronger position.',
          'Look for your own openings too. If your team has better cooldowns, stronger angles, or healthier players, neutral has already started tilting in your favor.',
          'The point is to notice the moment of weakness before everyone commits at once.',
        ],
      },
      {
        title: 'How each role plays neutral',
        paragraphs: [
          'Vanguards play neutral by testing space, threatening forward movement, protecting key lanes, and watching for the enemy to spend tools that make a push safer.',
          'Duelists play neutral by pressuring angles, poking, threatening backlines, and making the enemy respect their position before committing to a kill.',
          'Strategists play neutral by keeping the team stable, preserving major saves, holding safe sightlines, and using utility to deny the enemy opening.',
          'No role should treat neutral as permission to stand still. Everyone is either controlling space, denying space, baiting resources, or preparing for the punish.',
          'The best neutral plays often look small until the fight starts and the enemy is missing the cooldown, position, or health they needed.',
        ],
      },
      {
        title: 'Neutral checklist',
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
    heroId: 'tempo-and-ultimate-economy',
    heroName: 'Tempo, Fight Timing and Ultimate Economy',
    category: 'fundamentals',
    role: 'Fundamentals',
    image: '/images/heroes/doctor-strange.png',
    sourceLabel: 'Two outside articles, linked at the end of this guide',
    articleSources: [
      {
        label: 'The Importance of Tempo and Fight Timing in Overwatch, XTREME PS',
        url: 'https://www.xtremeps3.com/2026/03/06/the-importance-of-tempo-and-fight-timing-in-overwatch',
        note: 'Written about Overwatch, not Marvel Rivals. We kept only the ideas that fit any team fight.',
      },
      {
        label: 'Ultimate Economy in Marvel Rivals, MetaBot',
        url: 'https://metabot.gg/en/marvelrivals/guides/marvel-rivals-ultimate-economy-guide',
        note: 'Advice from a commercial site.',
      },
      {
        label: 'Ultimate Economy 101, Boostroom',
        url: 'https://boostroom.com/blog/ultimate-economy-101-marvel-rivals-when-to-hold-when-to-stack-when-to-commit',
        note: 'Further reading only. We could not read this article, so nothing in this guide is based on it.',
      },
    ],
    summary:
      'Tempo is about who sets the pace of a fight. Ultimate economy is about how a team earns and spends its ultimates. Between them, they help explain why some fights feel lost before anyone takes a shot.',
    poolJob:
      'Pick the moment to fight, and only spend an ultimate when you can say what it will buy.',
    pickWhen:
      'Use this guide when your team loses fights it looked ready to win, or when ultimates keep landing on nothing.',
    sections: [
      {
        title: 'Tempo: who sets the pace',
        paragraphs: [
          'Tempo belongs to whichever team is choosing when things happen. The other team is left answering.',
          'This idea comes from an XTREME PS article about Overwatch, not Marvel Rivals. Both games build team fights around cooldowns and ultimates, so we carried over the general ideas and left its hero examples behind.',
          'That article describes two styles: a fast team closes the gap and forces the fight, and a slow team holds good ground and waits to punish errors.',
          'It rates neither as better by default, but warns that a slow team may need to speed up when the enemy presses harder.',
        ],
      },
      {
        title: 'Fight when you have a reason',
        paragraphs: [
          'Before you commit, name the advantage you are committing on.',
          'The Overwatch article from XTREME PS lists three good reasons: your team already got a pick, you have more ultimates ready, or the enemy is coming back from spawn a few at a time.',
          'It singles out going in too early as the big timing mistake, and says that without one of those reasons you are fighting on the enemy’s terms.',
        ],
      },
      {
        title: 'The three stages of a fight',
        paragraphs: [
          'XTREME PS splits an Overwatch team fight into poke, engagement and cleanup. The same split works for a Marvel Rivals fight.',
          'Poke: both teams trade from range and neither side is all in. Big cooldowns spent now buy very little.',
          'Engagement: a team sees its chance and everyone moves on it at once. Whichever side handles this stage better usually comes out with the pace.',
          'Cleanup: the winners close out the fight without chasing survivors toward their spawn, and keep their ultimates once the result is clear.',
          'Poke also tells you things. Note which big abilities the enemy uses early, since they may still be on cooldown when the fight starts, and tell your team, whoever you queued with.',
        ],
      },
      {
        title: 'Keep the pace after a good moment',
        paragraphs: [
          'Enemies who die at different times come back at different times, so a won fight can roll into the next one with your team ahead on numbers.',
          'XTREME PS calls this staggering in its Overwatch article. The part that carries over is simple: be ready for the first enemy back, and do not follow them into their spawn.',
          'The pace can also turn mid-fight. The Overwatch examples are a support going down or a tank using up its kit. In Marvel Rivals terms, think of a Strategist or a Vanguard. Moments like these are worth acting on quickly.',
        ],
      },
      {
        title: 'Treat ultimates as a budget',
        paragraphs: [
          'MetaBot’s comparison is money: ultimates are something a team saves and spends, and in its view good spending is what wins objectives.',
          'Its test is what you get back. A good one hits several enemies at once, at a moment they cannot get away. A weak one goes on a lone target who survives, or on a kill your team would have got anyway.',
          'Before using one, MetaBot suggests saying what it should achieve. Without a good answer, it says to wait.',
          'Holding has a limit too. XTREME PS warns, again about Overwatch, that sitting on ultimates for too long gives the enemy time to build theirs.',
        ],
      },
      {
        title: 'What to do with the ultimate count',
        paragraphs: [
          'Compare what each team has ready before the fight, then let that choose your plan.',
          'XTREME PS offers this simple guide in its Overwatch article. Ahead on ultimates: go in. Even: get a pick first. Behind: stall. All spent: reset.',
          'Treat it as a starting point, not a rule. MetaBot, writing about Marvel Rivals, points out that you never see the enemy’s exact charge, so your count is an estimate.',
        ],
      },
      {
        title: 'When to spend an ultimate',
        paragraphs: [
          'On whether to hold, MetaBot’s answer is usually yes: waiting tends to beat using an ultimate as soon as it is ready.',
          'Its time to commit is when the enemy has spent a key ultimate, so yours meets less resistance.',
          'MetaBot adds that one ultimate can set up another, but without coordination both can be lost, so agree the order first.',
          'MetaBot also treats keeping one ultimate back as a sound habit, so your team still has an answer if the enemy counters.',
        ],
      },
      {
        title: 'Read the enemy’s ultimates',
        paragraphs: [
          'You cannot see enemy charge, so MetaBot suggests estimating it from what you can see and hear.',
          'Its cues: voice lines tell you an ultimate was just used, the time since then tells you how close the next may be, and heavy healing or damage suggests charge is building quickly.',
          'Its advice is to assume the dangerous ultimate is available until you know otherwise.',
          'MetaBot also describes baiting: let a tough or mobile hero draw the ultimate, survive it with cover or a defensive tool, then commit while the enemy has nothing left.',
          'It also warns against overreacting: using all your cooldowns against an ultimate the enemy does not have.',
        ],
      },
      {
        title: 'Practise it in one match',
        paragraphs: [
          'Pick one habit per match rather than trying all of this at once.',
          'MetaBot suggests tracking every enemy ultimate for a whole match, then looking back at losses for spending errors, such as a whole ultimate used on one easy kill.',
          'XTREME PS, writing about Overwatch, suggests watching your own footage to learn the moments when a fight turns, so you can spot them live.',
        ],
      },
      {
        title: 'What the RivalsPulse overlay can show',
        paragraphs: [
          'The RivalsPulse overlay, coming soon to the Overwolf store, has a live tempo chip on its in-game top bar in Quick Match and Ranked.',
          'The chip shows Quiet, Rising, Fast or Reset, based on deaths on both teams over the last 20 seconds.',
          'It does not use cooldowns or ultimate charge. Reading enemy ultimates stays your job.',
          'It is an early version. Nobody has checked it in a real match yet and its thresholds are still guesses, so treat it as a rough hint.',
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
          'A major mistake is shooting what is directly in front of you instead of what is causing the problem.',
          'If a tank is forward but cannot keep themselves alive without supports, the supports may become the priority.',
          'If a flanker is living in your backline, that flanker may become the priority.',
          'If a Duelist is uncontested and receiving constant healing, solving that support line may matter more than shooting the tank.',
          'If an enemy tank is taking too much space and your team cannot move, that tank may become the immediate problem.',
        ],
      },
      {
        title: 'Do not force priority through bad timing',
        paragraphs: [
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
        paragraphs: [
          'Sometimes the biggest problem is not in the enemy backline. It is on your supports.',
          'If an enemy dives your Strategists, peeling them can become the correct priority.',
          'The guide frames target priority as solving the problem in front of your team.',
          'You may not get a flashy kill, but protecting the support line can keep the fight playable.',
          'If the situation turns unfavorable while peeling, reset instead of feeding into the same problem.',
        ],
      },
      {
        title: 'Three questions for every fight',
        paragraphs: [
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
        paragraphs: [
          'Off-angles make the enemy fight your team in front while also reacting to you from the side, high ground, or backline.',
          'If nobody contests you, you may get free kills.',
          'If they do contest you, you still pull attention away from the main fight.',
          'Attention split creates hesitation, missed reactions, and positioning mistakes.',
        ],
      },
      {
        title: 'Play your life on the angle',
        paragraphs: [
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
        paragraphs: [
          'Standing behind your tank all game makes your damage predictable.',
          'Predictable damage is easier for supports to heal through.',
          'DPS pressure is not only about raw numbers. It is about making enemy decisions harder.',
          'An off-angle can force support abilities, attention, ultimates, and cooldowns even without a kill.',
        ],
      },
      {
        title: 'Take the value and reset',
        paragraphs: [
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
        paragraphs: [
          'If the fight stops being favorable, the Duelist job is to reset.',
          'A low enemy is not always worth chasing if you can die too.',
          'Getting one kill does not mean you should overstay.',
          'Sometimes the smartest play is abandoning the fight entirely because the cards are no longer in your favor.',
        ],
      },
      {
        title: 'Health packs are your third support',
        paragraphs: [
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
        paragraphs: [
          'If shooting the tank is not moving the fight, change your angle and find the target that matters.',
          'A support may become the priority if they are keeping the frontline alive.',
          'A backline DPS may become the priority if they are controlling your team.',
          'Sometimes whoever falls into your line of sight is the right temporary target because they are available now.',
        ],
      },
      {
        title: 'Solve the fight in front of you',
        paragraphs: [
          'The guide summarizes target priority as solving the problem in front of you.',
          'Do not chase a theoretical perfect target if the fight gives you a better immediate option.',
          'Recognize the shift mid-fight and act before the opportunity disappears.',
        ],
      },
    ],
    ultimates: [],
  },
];

export function findHeroGuide(heroId: string | null): HeroGuide | null {
  return HERO_GUIDES.find((guide) => guide.heroId === heroId) ?? null;
}
