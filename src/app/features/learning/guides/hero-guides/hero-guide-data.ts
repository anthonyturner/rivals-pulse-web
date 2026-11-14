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
          "Start by learning a hero's rhythm: primary fire, abilities and the situations each tool solves. Aim matters, but positioning, timing and teamwork determine whether that aim has a useful opportunity. Passives shape the hero automatically; active abilities give you decisions to improve through practice.",
          "Before spending a cooldown, name the swing it can create: an opening through damage, an ally saved by healing or protection, or a route changed by utility. An ability being ready is not itself a reason to use it. Apply the same test to ultimates, which build through contribution and time: give them a clear fight-winning purpose rather than holding them forever or spending them alone.",
        ],
      },
      {
        title: 'Understand the three role jobs',
        paragraphs: [
          "The three roles describe different ways to make a team fight workable. Vanguards survive pressure and claim ground so teammates can use safer angles. Duelists turn openings into pressure and eliminations, threatening isolated enemies or the backline. Strategists keep teammates alive while contributing utility, damage and high-impact decisions; healing is essential, but it is not their whole job.",
          "Think of that durable front, finishing pressure and support as connected responsibilities rather than three separate games. Your role gives you a starting job, not a script. Read the current fight and help solve the problem that is preventing your team from moving forward.",
        ],
      },
      {
        title: 'Learn heroes, synergies, and matchups',
        paragraphs: [
          "Learn matchups by looking at tools, not only hero names. Ask which ability lets an enemy pressure you, escape, deny a play or punish a mistake. Briefly trying an unfamiliar hero teaches you what their cooldowns look like from the other side, even when you have no intention of mastering the entire roster.",
          "Team-ups can add benefits, but a hero does not need a synergy to contribute. Composition still matters: adjust to the map, teammates and actual threats instead of forcing a rigid formula. When one enemy repeatedly causes trouble, identify the tool enabling them, then consider a different hero, angle or coordinated response that limits it.",
        ],
      },
      {
        title: 'Choose a main without trapping yourself',
        paragraphs: [
          "Try heroes that interest you before deciding what fits. Enjoyment and understanding produce more useful practice than choosing a supposedly optimal hero you do not know. Build comfort on roughly three or four heroes with different answers to common problems, rather than spreading your practice across the whole roster.",
          "That small pool should leave room for bans, awkward matchups and team needs as competition becomes more demanding. A tier list can describe a different experience from yours: top-level strength may not transfer to your platform, experience or current skill. Choose a main you can learn consistently without making yourself unable to adapt.",
        ],
      },
      {
        title: 'Play modes through their important moments',
        paragraphs: [
          "Each mode has moments worth committing resources to. In Convoy, a checkpoint changes later spawns, so force defenders away and turn the fight win into payload movement. In Domination, winning a full team fight usually creates safer capture time than giving up a winnable fight for a few isolated seconds on the point.",
          "Map knowledge makes those conversions easier. Learn where health packs, alternative routes, high ground and destructible cover let you recover or change an angle. Before the next fight, ask where you could retreat, rotate or pressure from a better position. The environment is useful when it lets your team contribute without becoming an easy target.",
        ],
      },
      {
        title: 'Win fights before chasing progress',
        paragraphs: [
          "A team fight is the committed clash in which both sides spend abilities and ultimates. Winning that clash generally buys more objective progress than arriving alone, one player after another. Stay close enough to help teammates address the same problem; six disconnected duels rarely create coordinated pressure.",
          "Once a fight is clearly lost, disengage and regroup rather than feed staggered eliminations. After a win, take the secure progress available: capture or push, claim a better position, and prepare for the enemy's return. Keep tracking cooldowns and ultimates across the fight, because shared resources become useful opportunities only when the team can act on them.",
        ],
      },
      {
        title: 'Improve one repeatable habit at a time',
        paragraphs: [
          "Use early matches to learn instead of treating every result as a verdict on your ability. Choose one repeatable focus, such as keeping an escape ready, learning health-pack routes or grouping before entry. Quick Play offers room to test heroes and limits; Competitive asks for more awareness, flexibility and resource discipline.",
          "When a death frustrates you, identify the information, position, cooldown or timing decision that could have made it safer. Small improvements repeated over matches are enough to make you a reliable teammate before you master every mechanic. Keep curiosity and enjoyment in the process: they sustain practice better than forcing a hero or style you dislike.",
        ],
      },
    ],
    ultimates: [],
    workedExample: {
      title: "Hypothetical practice: regroup before the next payload fight",
      paragraphs: [
        "Imagine your team has lost a player and the remaining teammates are arriving from spawn at different times. Entering alone to touch the payload may feel like playing the objective, but another isolated death delays the team fight that could actually move it.",
        "Use a safe retreat and health-pack route, group with teammates, and enter the next fight with your important abilities available. After a win, convert it into payload progress and a position for the enemy's return. This is a practice scenario for the guide's regroup-and-convert principle, not a promise that retreat is possible before every objective deadline.",
      ],
    },
    practiceFocus: "For one match, make grouping before the committed fight your only focus. On each death, check whether teammates could support the entry and whether your important cooldowns were available; after a won fight, deliberately convert it into objective progress or a stronger position.",
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
          "Vanguard is a fundamentals role, not simply a durability choice. You need awareness, map knowledge, cooldown discipline and timing to decide when to hold, give ground, protect a teammate or leave. Playing near the front often lets you read both the enemy in front and the teammates behind you.",
          "The central aim is to hold as much useful space as you safely can while staying alive. You do not need to make every play personally. You need to create a fight in which your teammates can use their own tools, then recognize when their next turn needs your support.",
        ],
      },
      {
        title: 'Understand turns',
        paragraphs: [
          "The source describes a fight as a rhythm of turns: one team spends pressure, the other answers, and control of space shifts. Dive pressure often goes first. If Venom is attacking your supports, their attention and healing are occupied; walking forward alone can leave you with no follow-up and no recovery.",
          "When that diver retreats low and draws healing from their own supports, the window can reverse. Advance and spend offensive tools while the enemy is recovering. In a front-to-back fight, the same opening may come from their tank taking more poke and backing away. On your turn, turn resources into pressure; on theirs, use cover, preserve health and give ground when necessary.",
        ],
      },
      {
        title: 'Main tank job: own main space',
        paragraphs: [
          "The main tank owns the objective lane, important choke points and the route the team must cross. Think of useful ground as properties on a board: claim what your team can actually hold. After a won fight, defaulting to the cart gives away the chance to set a forward line and make the enemy fight sooner.",
          "A forward hold can buy payload distance during neutral, even if the next fight is eventually lost, but it must remain a soft hold. If several enemies emerge or your supports are distant on the cart, yield before your health becomes critical. Stay near cover and fall back from corner to corner instead of gambling on an ego hold or surrendering the entire map at once.",
        ],
      },
      {
        title: 'Cover, corners, and right-hand peeks',
        paragraphs: [
          "Holding space is unsustainable if the enemy can deal unlimited free damage to you. Corners and right-hand peeks let you contribute while exposing less of your body. Taking damage to feed support ultimate charge is not useful if it forces you out of valuable ground or gets you killed.",
          "The right cover line also depends on enemy power positions. A Duelist on height may create too many angles for the usual corner to remain safe. A tank with accessible vertical movement can answer that position differently from Emma Frost or another less mobile frontline tank. Know the limits of your hero; when the height cannot be contested safely, move to the next cover line rather than die proving it.",
        ],
      },
      {
        title: 'Marking angles depends on your tank',
        paragraphs: [
          "Marking an enemy angle means limiting its value, not automatically chasing its owner. Your range, movement and role in the composition decide how to do that. Magneto can often influence angles by shooting from the point; Emma Frost can pressure some with her beam, but walking too far away may let the opposing tank reach her backline.",
          "A low-range frontline tank cannot afford to follow every Star-Lord or ranged threat and abandon main control. Mobile tanks such as Rogue, Hulk, Thor, Captain America and Venom can contest some side routes more naturally. Even then, decide how you will leave and whether the trip still serves your team's fight.",
        ],
      },
      {
        title: 'Off tank job: clear side space',
        paragraphs: [
          "With two tanks, the main tank can hold the objective and main route while the off tank clears side space, high ground and off-angles. Catching a Duelist on the route to your backline can force an early cooldown or retreat before they achieve anything. That recovery time may create the next forward turn for your team.",
          "The source uses Captain America and Venom as examples of closing quickly on poke heroes above the fight. Hulk, Rogue and Thor can meet divers on side routes and make them spend resources before reaching supports. These are purposeful assignments, not a licence for random pursuit: remove the angle that stops your team advancing, then reassess the main fight.",
        ],
      },
      {
        title: 'Solo tanking: play like a 600 HP support',
        paragraphs: [
          "The source's description of solo tanking as playing like a '600 HP support' is a way to emphasize the job, not a universal health value. As the only tank, your freedom to leave main for a creative angle is limited. The guide identifies Magneto, Emma Frost and Doctor Strange as comfortable options because their tools can hold the point, protect space and help teammates reliably.",
          "Your three connected responsibilities are to contest the objective or main space without dying, add damage and utility to the target your Duelists are actually attacking, and protect supports under a dive. When the backline is busy surviving, take cover first because healing may not reach you. Use shields, bubbles, poke or pressure to help them live, then look forward as the dive leaves. If both teams dive at once, support survival usually comes before helping your own diver: losing sustain can make the objective impossible to hold.",
        ],
      },
      {
        title: 'Support your Duelists on their turn',
        paragraphs: [
          "A solo tank with three Duelists usually supports their timing rather than inventing a separate flank. When Iron Fist, Spider-Man, Phoenix or another teammate makes a real commitment, help by shooting their target, protecting them where your kit permits, or taking enough ground to make that play safer.",
          "Look at the target they can actually reach. You may need to weave shots past the opposing tank toward the less durable hero your teammate is pressuring. If the Duelists are already ahead and likely to die without help, a little more space may be necessary. Balance that support against the cost of exposing your backline or abandoning the point as the only tank.",
        ],
      },
      {
        title: 'Ultimate timing for tanks',
        paragraphs: [
          "The guide warns against treating a tank ultimate as a risky opening move, particularly when you are the only tank. A cast during an active turn, after enemy resources are committed, often meets fewer clean answers. Strange's ultimate can protect a backline under a dive rather than announce a predictable engage before anyone has spent a cooldown.",
          "The Magneto example is an ultimate used during a frontline trade to deny healing on a low target, then turn the throw into offensive pressure. The wider lesson is timing, not a guaranteed result from either hero. Preserve the solo tank's life: a setup that gets you killed can hand the enemy far more space than the attempted ultimate could win.",
        ],
      },
      {
        title: 'Tank checklist',
        paragraphs: [
          "Before spending a major cooldown, identify whose turn it is. Advance when your team owns pressure or the enemy is recovering; give ground when the enemy is spending resources and your team needs to survive. Hold the furthest safe line, but keep a sequence of cover positions available for the retreat.",
          "Then match the assignment to your composition. Clear a side angle only when your hero can do it without abandoning a more important job. Alone on tank, connect support survival, objective control and your Duelists' target. Use ultimates within an active opportunity rather than building an easy-to-counter opening that costs your life.",
        ],
      },
    ],
    ultimates: [],
    workedExample: {
      title: "Hypothetical practice: wait out a dive, then take your turn",
      paragraphs: [
        "An enemy Venom reaches your supports while you are holding the main lane. Advancing at that moment would ask for healing and follow-up from teammates who are occupied surviving. Begin by using cover and helping them with the protection or pressure your position permits.",
        "If the diver leaves low and draws healing from the enemy backline, reassess: that recovery can become your team's forward turn. Support a reachable Duelist target and consider an ultimate during the committed exchange, not as a separate risky opener. When you are solo tanking, the objective deadline and support survival still constrain how far you can leave main; with two tanks, share those assignments instead of both chasing the diver.",
      ],
    },
    practiceFocus: "Before each major cooldown, name whose turn it is and the cover line you can return to. Review one death for whether a dive had occupied your supports, whether you abandoned a solo-tank responsibility, and whether an ultimate setup cost more space than it could win.",
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
        title: 'General philosophy: do not sit main',
        paragraphs: [
          'The guide opens with a clear warning: Captain America does not get full value by sitting in main and punching tanks the entire game.',
          'His value comes from pressure and displacement. You either help set up a dive by surrounding the enemy team or intercept a flanker before they reaches your supports.',
          'If your team has divers like Psylocke, Daredevil, Iron Fist, or Black Panther, look to aid their backline pressure instead of playing a slow frontline trade.',
          'If your supports are struggling, flip the job: stop enemy flankers before they get a clean engage.',
          'Cap is at his best when he stages intelligently, draws a circle around the enemy team, forces resources, and then decides whether the next touch is a kill attempt or a reset.',
        ],
      },
      {
        title: 'Sentinel Strike: punch into shield pressure',
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
    summary:
      'Jubilee is an active brawl and tempo Strategist who leapfrogs charged Blooming Balls with her frontline, detonates them for burst sustain and utility, and chains Sparkle Marks to keep enhanced Energy Plasmoids running.',
    poolJob:
      'Move the team forward one healing zone at a time, maintain the orb-detonation-mark loop, add damage while enhanced, and use Sparking Sprint to preserve momentum or escape danger.',
    pickWhen:
      'Pick Jubilee with a durable, grouped frontline that can occupy her Blooming Balls. Be cautious when your team is built around flyers, flankers, and multiple dive heroes who spread beyond her area healing.',
    sections: [
      {
        title: 'Playstyle: leapfrog the frontline',
        paragraphs: [
          'The guide describes Jubilee as a constant game of leapfrog: place a healing orb ahead of your Vanguards, let them step into it, charge and detonate it, then place the next orb farther forward.',
          'Each new Blooming Ball marks the next piece of space your team can safely occupy. Your healing layout should encourage forward movement instead of trailing behind the fight.',
          'Jubilee is not a passive healbot. She needs continuous involvement and clean ability sequencing to avoid low-output gaps.',
          'Think of her kit as a merry-go-round: build momentum with Sparking Sprint, ride that momentum through Sparkle Marks, then restart the cycle before it slows down.',
          'Her best fights are grouped brawls where healing, damage, detonations, buffs, and enemy debuffs can all affect several heroes at once.',
        ],
      },
      {
        title: 'Blooming Ball: feed the orb correctly',
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
          'Normal Energy Plasmoids provide modest healing and damage. Jubilee output rises when Sparking Sprint or a consumed Sparkle Mark activates the enhanced version.',
          'Enhanced fire shoots much faster, consumes no ammo, and raises both healing and damage output, so the entire ability loop should maximize its uptime.',
          'Use the enhanced stream to burst-heal a marked ally, charge the next orb, help burn the enemy frontline, or punish an exposed flyer.',
          'Do not reload during a window where enhanced fire is available. Hold the trigger and turn that temporary state into as much useful output as the fight allows.',
          'During quiet but unsafe moments, shoot the active orb to keep it charged. If the fight is truly over, recall it and recover resources instead.',
        ],
      },
      {
        title: 'Sparking Sprint: start, conserve, escape',
        paragraphs: [
          'Sparking Sprint provides movement speed, enhanced fire, and a boosted jump, making it both the starter for Jubilee rotation and her escape tool.',
          'The ability uses a resource meter. Cancel it as soon as the charge or reposition is complete instead of draining the entire meter.',
          'The boosted jump can quickly return Jubilee to her team, leave dangerous ground effects, or escape an enemy ultimate.',
          'When Sparking Sprint ends, Jubilee creates a small explosion that knocks back nearby enemies and heals nearby allies, including herself.',
          'Stay aware of the exit burst in close brawls, but do not remain in danger merely to force it. Survival keeps the full healing loop available.',
        ],
      },
      {
        title: 'Positioning and team composition',
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
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
        paragraphs: [
          'The guide says the sword ultimate is not used as often by the author.',
          'When you do swap to the katana ultimate, its biggest value is survival.',
          'It gives a movement boost and chunks of healing over time.',
          'Treat it as a defensive tool to buy time, stall point, or stay alive under heavy focus fire.',
          'The goal is to survive long enough for your team to swing momentum back.',
        ],
      },
      {
        title: 'Plushie Shield discipline',
        paragraphs: [
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
        paragraphs: [
          'Healing Factor triggers when you take massive burst damage or get hit by a lethal one-shot ability.',
          'It gives a brief window of invincibility and rapid healing to keep you alive.',
          'It effectively acts like a second life.',
          'It has a strict 45-second cooldown.',
          'You cannot fully control when it triggers, so play your life carefully and try not to pop it too early.',
        ],
      },
      {
        title: 'Tank discipline in full fights',
        paragraphs: [
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
        paragraphs: [
          "Neutral is the quieter work before and between the obvious turning points of a fight. In a fighting game, movement, spacing, small attacks and baiting come before the large combo or super move. In Marvel Rivals, teams similarly earn the conditions for a committed engage, elimination or ultimate.",
          "When neither side has a clear advantage, both are testing space, information, health and resources for a mistake they can punish. That is an active phase, not doing nothing. Recognizing it helps you see why a small decision before the spectacular play can decide whether that play is possible.",
        ],
      },
      {
        title: 'The fighting game comparison',
        paragraphs: [
          "The transcript uses Tekken to make this easier to see. A player stepping forward, retreating, poking or waiting is controlling range and encouraging an unsafe response. The desired mistake might be a wrong button, a move into the wrong distance, or a powerful option spent at an ineffective moment.",
          "The big combo, powered-up move or super is the conversion after that opening, rather than proof that the earlier movement was irrelevant. Carry the relationship into a team game: a small neutral error can give your team permission to commit, even though the final engage is the part everyone notices.",
        ],
      },
      {
        title: 'Neutral in Marvel Rivals',
        paragraphs: [
          "In Marvel Rivals, both teams contest the playable part of the map through positioning, cooldown use, baiting and restraint. Track your own resources alongside enemy movement, shields, defensive saves, healing tools and ultimates. You are looking for a useful exchange before either team is fully committed.",
          "Forcing an enemy cooldown while preserving your own can be enough to improve the next fight. Walking into danger, wasting a key ability or advancing before teammates are ready gives that first opening away instead. Enemy teams can also err by pushing too far or refusing to contest enough ground; both change which positions your team can safely occupy.",
        ],
      },
      {
        title: 'Why ultimates make neutral feel muddy',
        paragraphs: [
          "The transcript argues that frequent ultimates can obscure neutral's importance. Strategist ultimates may erase danger or sustain a team through it, while Duelist ultimates can remove players quickly. When those answers chain together, a match can feel like a race to build the next fight-winning button.",
          "That is the source's criticism of the rhythm, not evidence that neutral does not exist. The resource and positioning decisions before the ultimate sequence still happen. Look for that phase early enough to recognize the missing cooldown, health or ground that changes the coming exchange.",
        ],
      },
      {
        title: 'What you are looking for',
        paragraphs: [
          "An early movement ability, shield, stun, defensive save or healing burst may be the resource your team was waiting to draw out. An overextended enemy offers a target before their team is ready to trade. An enemy who yields too much ground instead lets you advance, build angles and begin the next fight from a stronger position.",
          "Compare those mistakes with your own team's health, cooldowns and angles. You may already have the better exchange without a visible elimination. The task is to notice when neutral starts tilting and coordinate a response before everyone commits indiscriminately.",
        ],
      },
      {
        title: 'How each role plays neutral',
        paragraphs: [
          "Vanguards test forward space, protect lanes and watch for the resources that make advancing safer. Duelists pressure angles, poke and threaten backlines so enemies must respect their position before the kill attempt. Strategists stabilize the team, preserve major saves and use safe sightlines and utility to deny the enemy opening.",
          "These jobs make neutral shared work. None of the roles should simply stand still waiting for a spectacular play. Control or deny ground, draw out a tool, or prepare to punish; the value of that small action often becomes clear only when the committed fight starts and the enemy lacks what they needed.",
        ],
      },
      {
        title: 'Neutral checklist',
        paragraphs: [
          "Begin by deciding whether either team has a real advantage. If neither does, identify the ground both sides want and the cooldowns that would make an engage safer. This turns a vague period of waiting into a specific information task.",
          "As the exchange develops, watch for excessive forward movement, needless retreat or a resource spent early. Before acting on it, check that your own next move creates pressure without giving back an easy punish. Neutral ends usefully when you recognize the opening and can convert it with the team, not simply when you grow impatient.",
        ],
      },
    ],
    ultimates: [],
    workedExample: {
      title: "Hypothetical practice: turn a spent cooldown into an opening",
      paragraphs: [
        "Both teams are healthy enough to fight, but neither owns a clear advantage. You pressure an angle from cover and notice an enemy spend a defensive tool before the main engage. The important result is the missing response, even if your first shots secure no elimination.",
        "Check whether teammates are ready, whether the route is playable and whether the enemy still has another answer. If those conditions support the play, move together to use the short advantage; if they do not, keep testing rather than assume one cooldown guarantees a kill. This illustrates the transcript's small neutral mistake leading to a larger opportunity, not a recorded video event.",
      ],
    },
    practiceFocus: "Choose one enemy defensive cooldown to follow for a match. Before committing, identify whether its use really changed the available space and whether teammates could act with you; review one exchange where you either used that opening or correctly declined it.",
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
          "Playing your life means keeping your influence available, not merely avoiding the death counter. The guide describes a common mistake across ranks: chasing a low enemy, securing the elimination and immediately dying, then assuming the trade was automatically worthwhile.",
          "That assumption is especially costly when you were the player creating pressure, holding an angle and forcing resources. A kill is only one source of value. Survival is an active skill because it lets you keep making the decisions that made the enemy uncomfortable in the first place.",
        ],
      },
      {
        title: 'What a trade actually costs',
        paragraphs: [
          "A trade can be a net loss even when the eliminated enemy is a support or Duelist. On death, you lose your active angle, target choices and ability to set the pace; the enemy no longer has to account for your next action. Assess that loss rather than counting one elimination against one death in isolation.",
          "The useful question is not only whether the kill is available, but whether it is worth dying for. Sometimes forcing three enemies to turn, drawing cooldowns and leaving alive contributes more than finishing a target. Those spent resources and diverted attention can open the fight for your teammates while you retain another chance to act.",
        ],
      },
      {
        title: 'Pressure without the kill',
        paragraphs: [
          "The Black Cat example is a flank whose first job may be attention rather than an immediate elimination. Making a support turn away from healing their tank, spending a defensive cooldown, or responding to a possible backline threat can already change the main fight.",
          "When that pressure leaves the enemy short of resources and your team gains ground, it has created real value even without a flashy finish. Your continued presence also creates uncertainty: enemies must think about where you are and who might be in danger. Much of that influence never appears on the scoreboard.",
        ],
      },
      {
        title: 'Alive pressure changes enemy behavior',
        paragraphs: [
          "An angle or threatened flank remains a problem the enemy must respect while you are alive. Once you die, that concern disappears. A deliberate reset can preserve it: spend a cooldown to leave, find a health pack, wait for resources and return rather than commit until there is no exit. Cooldowns are often shorter than death timers.",
          "The guide also describes the pressure that repeated survival puts on opponents. A threat they cannot finish may encourage impatience, tunnel vision or an overcommitted chase. Do not rely on an enemy making that mistake, but stay alive long enough to recognize it when they do.",
        ],
      },
      {
        title: 'Let low-health targets go',
        paragraphs: [
          "A target on 10 HP can still be the wrong chase. If finishing them would destroy your position or cost your life, let them leave and keep the fight playable. A low enemy looking for healing or a health pack is already contributing less to the current exchange.",
          "The source uses Star-Lord following someone into a room as an example of giving away a spacing advantage for an ego finish. You do not need to collect that elimination to preserve the pressure it created. Change targets and keep influencing the fight instead of entering a space that turns the chase against you.",
        ],
      },
      {
        title: 'Most deaths are commitment problems',
        paragraphs: [
          "The guide treats many deaths as a commitment problem before they are a mechanics problem. One more shot, dash, second or chase can feel necessary even after the position has stopped being useful. The respawn screen then hides the pressure and information that extra commitment cost.",
          "Recognize the moment the trade changes. An action that began as a good opportunity can become a bad commitment when cover, spacing or resources disappear. Ending it there gives you another turn; insisting on its original promise can remove you from the rest of the fight.",
        ],
      },
      {
        title: 'Staying alive collects information',
        paragraphs: [
          "Survival also extends the time you have to read the game. You can see rotations, cooldowns, emerging angles and opponents choosing to play safely, then change your target or position as that information arrives. Simply remaining a live threat affects how the map can be played.",
          "Those extra decisions accumulate. A well-timed angle, target swap or forced cooldown may be enough to swing a fight, but it must happen while you can still participate. Leaving room to stay alive creates more chances to recognize the useful moment than committing to every apparent opening at once.",
        ],
      },
      {
        title: 'Survival is active, not passive',
        paragraphs: [
          "Survival does not ask you to hide or refuse worthwhile risks. It asks you to distinguish a useful opportunity from a commitment that has become too expensive. Decide when to push, pressure, disengage or abandon a play entirely, rather than treating constant action as the goal.",
          "A complete reset can prepare another angle, another forced cooldown and another chance to pressure a support. Strong play is not necessarily forcing something every few seconds. It is repeatedly giving yourself a realistic opportunity to affect the next exchange.",
        ],
      },
      {
        title: 'Measure pressure, not only kills',
        paragraphs: [
          "Use kills as part of the assessment, not its entire definition. Ask what pressure remained active, what resources were forced and whether you stayed available for the fight after your first play. A surviving threat can influence several decisions where a one-for-one trade ends that contribution immediately.",
          "The guide's central habit is to measure the pressure you maintain. Some highly influential players achieve that by surviving long enough to be involved throughout a fight rather than initiating the most reckless number of them. That is the practical meaning of survival discipline.",
        ],
      },
    ],
    ultimates: [],
    workedExample: {
      title: "The Star-Lord chase that gives away spacing",
      paragraphs: [
        "The source's example is a low target retreating into a room while Star-Lord has been useful at a safer distance. Following solely to collect the last few points of health trades away the spacing that made the pressure valuable and may leave no useful exit.",
        "Let that target look for healing, switch to the next problem in the fight and keep a recovery route available. The initial pressure has already reduced the enemy's contribution. This is the guide's decision example, not a claim that every low target should escape: the question is whether finishing them is worth the position and life it may cost.",
      ],
    },
    practiceFocus: "For one match, stop each chase when it would remove your recovery route or spacing advantage. Review a low-health target you let leave and ask whether changing targets kept useful pressure active, then compare that with a death caused by one extra commitment.",
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
          "The guide opens with players dying within the first 10 seconds after leaving spawn, before a real fight has formed. Such deaths often follow an unnecessary route or peek, not a coordinated ultimate or full-team collapse. Calling the action looking, poking or bad luck can hide the pacing mistake underneath it.",
          "Engagement discipline is recognizing when the fight is ready to be played. Mechanics matter, but so does resisting the urge to shoot, push, dive or brawl simply because an enemy becomes visible. Sometimes the valuable decision is to wait until your action has a useful timing window.",
        ],
      },
      {
        title: 'Do not treat setup like the fight',
        paragraphs: [
          "Walking straight down main and firing at the first target is exposure when it creates no useful opening. Every needless peek offers a punish. Even surviving it can force a Strategist to repair avoidable damage or a Vanguard to spend protection before the actual fight begins.",
          "That bill is paid by the team's resources and pace, not just your health bar. Damage numbers alone do not justify it: shooting an actively healed tank from open ground may accomplish little while making you much easier to remove. Judge whether the action changes the fight rather than whether it increases a total.",
        ],
      },
      {
        title: 'Split every fight into setup and execution',
        paragraphs: [
          "Separate preparation from execution. During setup, become healthy, find an angle, identify reachable targets, locate teammates and read both teams' resources. The aim is to enter the committed fight with health, cooldowns and position intact, not to farm damage before anyone can follow it.",
          "Cover and a prepared off-angle let you wait for information, a spent cooldown or a teammate's opening without paying for every second in damage. Being able to shoot, dive or brawl is not proof that this is the right moment. Even a five-second wait can create a better opportunity than an immediate commitment.",
        ],
      },
      {
        title: 'Cover is your default position',
        paragraphs: [
          "Start from cover instead of treating it as an emergency destination after a lost trade. When you establish an angle, identify the retreat, nearest health pack and nearest Strategist before pressure makes those decisions urgent.",
          "The goal is pressure with an escape available. If you can survive, reset and threaten again, the action is repeatable. If the position leaves you exposed and forces teammates to rescue it, the apparent aggression is consuming the resources your team needs for the fight itself.",
        ],
      },
      {
        title: 'Ask who can actually die',
        paragraphs: [
          "Replace the question of who you can shoot with who can actually die. Visibility and vulnerability are different. A target with cooldowns, healing, cover or a straightforward escape may not be worth committing to yet.",
          "Look instead for the change that makes the target punishable: an overextension, an important support cooldown used, a tank facing the wrong way or a player separated from teammates. Reliable engagement turns those real windows into action rather than trying to force every visible opponent into becoming one.",
        ],
      },
      {
        title: 'Let the frontline open the fight',
        paragraphs: [
          "Duelists, especially less durable ones, do not need to be the first player seen in every fight. Let the Vanguard take space and draw attention so the frontline pressure makes enemies spend resources or look away.",
          "That change is the bridge between positioning and effective damage. Once the enemy is occupied elsewhere, your angle can contribute to the team's committed action instead of exposing you alone during setup. The patience is purposeful: you are waiting for pressure that your own timing can convert.",
        ],
      },
      {
        title: 'Execution starts after the window appears',
        paragraphs: [
          "Execution is the point at which you commit damage, a dive, an off-angle or a brawl after the opening appears. Space gained by teammates, enemy resources spent, an isolated target or opponents looking away all improve the chance that your pressure becomes a final blow.",
          "Your job is to convert the opportunity, not manufacture every opening from an unsuitable position. If none of those conditions exists, rushing can become the unforced error that decides the fight. Be patient before the window, then act decisively when it becomes real rather than hesitating after the chance has arrived.",
        ],
      },
      {
        title: 'Quick discipline checklist',
        paragraphs: [
          "Before a peek, identify whether you are still setting up or already executing. Begin from cover with a retreat available, enter healthy where possible, and check where teammates are before committing. Then look for the specific cooldown, overextension, isolation or diverted attention that makes the play useful.",
          "Do not confuse safe-looking damage totals with a real opening. Let frontline pressure create attention you can use; when the window appears, convert it. When it does not, waiting or changing position while preserving resources is the disciplined action, not a failure to participate.",
        ],
      },
    ],
    ultimates: [],
    workedExample: {
      title: "Hypothetical practice: wait for the tank trade to create an angle",
      paragraphs: [
        "A fully supported enemy tank is visible down main, but your own frontline has not taken space. Standing in the open to add damage may only force your Strategists to heal you and spend protection before anyone has a useful target.",
        "Prepare behind cover, locate an exit and wait for your Vanguard's pressure to turn attention or draw an important cooldown. Then check which target is actually vulnerable and commit with the team. This hypothetical exercise separates setup from execution; it does not require waiting passively when a real opening already exists.",
      ],
    },
    practiceFocus: "Before exposing yourself in each fight, say whether you are setting up or executing and name the opening you intend to use. Review an early death for missing cover, health, teammate timing or a genuinely vulnerable target rather than judging it only by damage dealt.",
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
          "Tempo describes which team chooses when things happen and which team has to answer. This concept comes here from XTREME PS's article about Overwatch, not Marvel Rivals. We carry over the team-fight ideas that fit both games and leave its hero-specific examples behind.",
          "The article contrasts a fast team closing distance to force action with a slower team holding useful ground and punishing errors. Neither is automatically better. Even a team that prefers to wait may need to speed up when enemy pressure changes the situation; pace is a response to the fight, not a permanent identity.",
        ],
      },
      {
        title: 'Fight when you have a reason',
        paragraphs: [
          "Before committing, identify the advantage you expect to use. XTREME PS names three reasons in its Overwatch discussion: a pick already secured, more ultimates available, or opponents returning from spawn separately. These are useful prompts to read a team fight rather than instructions to charge regardless of position.",
          "The article treats going too early as the central timing mistake. Without a reason the team can act on, you may simply accept the enemy's preferred fight. Name the opportunity first so teammates can judge whether they are ready to make it matter.",
        ],
      },
      {
        title: 'The three stages of a fight',
        paragraphs: [
          "XTREME PS divides an Overwatch fight into poke, engagement and cleanup, a distinction that also helps explain a Marvel Rivals exchange. During poke, neither side is fully committed and large cooldowns may buy little. Use those ranged trades to notice important enemy abilities spent early and communicate what might still be missing when the real clash begins.",
          "Engagement starts when a team acts on its opportunity together; handling that moment well usually sets the pace. Cleanup converts the result without chasing survivors toward their spawn. Once the outcome is clear, keep unneeded ultimates rather than spend them on a fight already won.",
        ],
      },
      {
        title: 'Keep the pace after a good moment',
        paragraphs: [
          "Eliminations at different times produce returns at different times. XTREME PS calls that staggering in its Overwatch article. The transferable lesson is to prepare for the first enemy back so a won fight can lead into a numbers advantage, without following survivors into their spawn.",
          "The pace can reverse during a fight as well. The source's examples include a support dying or a tank exhausting its kit; the corresponding roles in Marvel Rivals are Strategist and Vanguard. Notice such changes quickly instead of continuing the plan for a fight whose resources have already changed.",
        ],
      },
      {
        title: 'Treat ultimates as a budget',
        paragraphs: [
          "MetaBot compares ultimate economy to money: a team earns, saves and spends a limited resource, and the spending should buy objective value. Its test is the return. Catching several opponents when they cannot escape can be strong value, while spending it on a lone target who survives, or on a kill the team would secure anyway, may achieve little.",
          "Before the cast, say what it should accomplish; without a useful answer, MetaBot advises waiting. Saving is not unlimited virtue either. XTREME PS warns in its Overwatch article that holding ultimates too long lets the opposing team build their own. The decision balances a meaningful purpose against the cost of remaining inactive.",
        ],
      },
      {
        title: 'What to do with the ultimate count',
        paragraphs: [
          "Compare the tools both teams may have before deciding the next fight. XTREME PS's Overwatch starting point is to attack with an ultimate advantage, find a pick when even, stall when behind, and reset after resources are spent.",
          "Keep that as a framework rather than a rule that overrides the map or current fight. As MetaBot notes for Marvel Rivals, enemy ultimate charge is not visible: your count is an estimate. Plan around that uncertainty instead of treating a guessed advantage as a measured fact.",
        ],
      },
      {
        title: 'When to spend an ultimate',
        paragraphs: [
          "MetaBot generally prefers waiting for a useful commitment over casting as soon as an ultimate becomes available. One promising window is after an important enemy ultimate has been used, because your own play may face less resistance.",
          "A first ultimate can also prepare a second, but an uncoordinated pair can waste both. Agree the sequence rather than overlap by instinct. MetaBot recommends retaining an ultimate as a possible answer when appropriate, so a counter does not find the whole team without resources. These are attributed planning habits, not a requirement to hold in every situation.",
        ],
      },
      {
        title: 'Read the enemy’s ultimates',
        paragraphs: [
          "You cannot read an opponent's exact charge. MetaBot instead suggests listening for an ultimate voice line, noting time since its use and observing heavy damage or healing that may build the next one. Its cautious assumption is that a dangerous ultimate is available until there is a reason to think otherwise.",
          "That caution should guide a response rather than consume every cooldown. The article describes a durable or mobile hero drawing the ultimate, surviving with cover or a defensive tool, and allowing the team to commit afterward. It also warns against spending all your defenses against an ultimate the enemy does not actually have.",
        ],
      },
      {
        title: 'Practise it in one match',
        paragraphs: [
          "Practise one part of the decision process at a time. MetaBot suggests following enemy ultimate use through a match, then reviewing lost fights for spending errors such as a full ultimate committed to an easy kill.",
          "XTREME PS's Overwatch advice is to review your own footage for the moments a fight changes direction. Applied as an observation exercise, that can help you recognize those changes live. Use the replay to explain a decision, not merely to confirm whether the final cast produced a highlight.",
        ],
      },
      {
        title: 'What the RivalsPulse overlay can show',
        paragraphs: [
          "The RivalsPulse overlay, coming soon to the Overwolf store, has a live tempo chip on the in-game top bar for Quick Match and Ranked. Its labels are Quiet, Rising, Fast and Reset, based on deaths across both teams during the previous 20 seconds.",
          "The chip does not read cooldowns or ultimate charge, so enemy-ultimate decisions remain yours. It is an early version. Nobody has checked it in a real match yet and its thresholds are still guesses, so treat it as a rough hint. It is not a tested account of the fight or a prediction of the enemy's next cast.",
        ],
      },
    ],
    ultimates: [],
    workedExample: {
      title: "Hypothetical practice: agree which ultimate comes first",
      paragraphs: [
        "Before an engagement, your team believes an enemy defensive ultimate is available, but cannot see its charge. Agree which friendly ultimate is intended to force that answer and which resource can remain available if the enemy counters. Name the objective value you expect rather than cast two abilities at once by habit.",
        "Read what happens next. If the first play already settles the fight, keep the second ultimate for later; if a coordinated follow-up is genuinely needed, use the planned sequence. This is a hypothetical application of the articles' spending and timing ideas, not a fixed ultimate-count rule or an account of a source-video event.",
      ],
    },
    practiceFocus: "For one match, name the intended purpose before each ultimate and notice which enemy ultimate has actually been used. Review one lost fight for premature spending, unnecessary overlap or holding too long; keep the enemy charge estimate separate from information you truly observed.",
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
          "This lesson reflects the source's Season 8.5 discussion, not a current tier list. The author argues that arguing only about whether Cyclops or Black Cat is broken, S-tier or weak misses the broader importance of discipline in that patch.",
          "The mistakes highlighted are often decisions about the fight rather than execution: an extra peek, an exposed rotation, a chase too far or a cooldown spent early. Positioning, timing, resources and engagement judgement can matter more than exceptional mechanics when a patch punishes those avoidable errors. The claim is about making fewer mistakes, not finding a hero that removes the need to learn them.",
        ],
      },
      {
        title: 'Cyclops punishes bad habits',
        paragraphs: [
          "The guide uses Cyclops to show what a threatening angle punishes. Its concern is not simply his damage, but the wide peek, open-sightline rotation and unnecessary time spent visible that let that damage reach you. Habits that previously escaped punishment can become costly in a different patch or matchup.",
          "The author frames that pressure as a reason to respect position rather than proof that the hero is impossible. Players already breaking sightlines and limiting exposure have an answer to practise; players who keep offering the same angle may feel the matchup is exposing them everywhere. Keep this as the source's Season 8.5 example rather than a fresh balance judgement.",
        ],
      },
      {
        title: 'Position relative to danger',
        paragraphs: [
          "A position is useful relative to danger, not simply because of its map location. Ask whether you can break line of sight, retreat when opponents look at you, or move again without crossing the most dangerous angle.",
          "Also consider what happens if several enemies turn toward you at once. A nominally good spot can become unplayable when it has no protected exit. The source uses Cyclops to make those questions harder to ignore, but the position should answer them regardless of which hero currently controls the lane.",
        ],
      },
      {
        title: 'Adjust to the enemy composition',
        paragraphs: [
          "Movement should change with the enemy composition. In the source's Cyclops example, locate his position, identify the angle he controls and check whether he can see the rotation you are about to make. Count how many opponents could actually shoot you when you step out.",
          "The same awareness applies when Phoenix or Hela owns a sightline. Adjust to the lobby instead of repeating your character's preferred route into whatever is watching it. Respect for an angle is information used to choose a better action, not a requirement to become afraid of every contest.",
        ],
      },
      {
        title: 'Poke comps win with pressure',
        paragraphs: [
          "The Season 8.5 review describes more poke-oriented pressure involving Phoenix, Hela, Cyclops and certain support compositions. Its distinction is between damage as a number and pressure as the way damage makes the next decision difficult.",
          "A poke team need not eliminate someone immediately to create an advantage. Repeatedly dangerous angles and rotations can cost health, force supports to use cooldowns, exhaust tank resources and push the team into awkward positions. By the committed fight, those small mistakes may already have made the exchange feel lost.",
        ],
      },
      {
        title: 'Poke is happy winning slowly',
        paragraphs: [
          "The source contrasts a dive composition looking for an isolated target, missing cooldown or clean entry with a poke composition content to win more slowly. Poke can remain in neutral and wait for a support's early ability, a tank's resources spent before claiming ground or a Duelist's impatience.",
          "A longer neutral phase gives those mistakes more chances to accumulate. That is why the lesson emphasizes patience: receiving pressure does not create an obligation to answer at once. Waiting can preserve the resources needed for a better window rather than let the enemy dictate the moment you commit.",
        ],
      },
      {
        title: 'Do not fight poke on its terms',
        paragraphs: [
          "Walking straight down main, absorbing avoidable damage, spending protection early and forcing a weak fight accepts a poke team's preferred exchange. Start by respecting sightlines instead of treating every visible angle as a challenge you must take immediately.",
          "A different route, a pause or several seconds without an exposed action can be the useful response. Discipline may look uneventful before it pays off. The purpose of waiting is to stop supplying free mistakes and prepare a fight on terms your own composition can use.",
        ],
      },
      {
        title: 'Health is a resource',
        paragraphs: [
          "Health is part of the resource plan before the first elimination. Entering at half health because of repeated peeks makes the real fight harder. The guide describes how valuable supports become in a poke-heavy setting because their sustain keeps that preparation stable.",
          "Its Season 8.5 examples are White Fox supporting off-angles and making poke heroes harder to isolate, and Luna adding ranged damage while keeping the team healthy. Those are era-specific observations, not updated recommendations. The wider role lesson is to combine sustain, useful pressure and movement; tanks also have to plan their approach rather than assume claiming space is simply walking forward.",
        ],
      },
      {
        title: 'Stop forcing every window',
        paragraphs: [
          "Not every available target, moment or fight is yours to force. The guide's disciplined player waits for a useful opportunity, then acts promptly when it arrives. Patient setup and decisive execution belong to the same process rather than opposing styles.",
          "The source argues that Season 8.5 exposed existing problems with positioning, timing, resources and engagement instead of creating them. Metas and hero rankings change, but reducing those avoidable errors remains a way to improve beyond a particular patch. Carry the decision habits forward while keeping the source's balance examples in their original era.",
        ],
      },
    ],
    ultimates: [],
    workedExample: {
      title: "Season 8.5 practice: a rotation watched by Cyclops",
      paragraphs: [
        "In the setting discussed by the source, imagine Cyclops watching the open route you normally use. Crossing it immediately and entering the next fight damaged gives the poke composition exactly the gradual resource advantage it wants.",
        "Locate the dangerous angle and choose a covered route or wait until the pressure changes before exposing yourself. Preserve health for the committed fight, then act promptly on a real opening. This is a hypothetical use of the review's Season 8.5 example; it does not assert today's hero balance or guarantee that every map offers a safe alternative before the objective deadline.",
      ],
    },
    practiceFocus: "For one match, check the enemy-controlled sightline before every rotation and preserve health for the committed fight. Review a damaged entry or early death for an avoidable extra peek, then choose the covered route or waiting decision you would try next time.",
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
          'A kill is one way to change a fight, but an enemy who has to respect your angle is already making a different decision. A live threat on the flank can hold attention or close off a route even before it secures a final blow. Once you die, the enemy no longer has to account for that threat; survival is part of the pressure, not a separate concern.',
        ],
      },
      {
        title: 'Survive, reset, and re-enter',
        paragraphs: [
          'When an angle stops being favorable, spend what you need to leave rather than trading your life for a fragile attempt. Recover behind cover, through your Strategists, or at a health pack when that is the fastest safe route. Returning with health and cooldowns gives the enemy a problem again; dying removes your presence for the trip back from spawn.',
        ],
      },
      {
        title: 'Quick pressure checklist',
        paragraphs: [
          'Before committing further, ask whether being alive here is already forcing a useful reaction. If it is, protect that value. Use your disengage before the enemy collapses on you, then return when your resources make another attempt possible. The goal is sustained respect for your position, not staying in the same place until someone kills you.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: keep an angle alive',
      paragraphs: [
        'Imagine you are threatening a side route while your team fights in front. An enemy turns to watch you, but finishing a kill would require leaving cover. Instead, you recover at a nearby health pack and return with your cooldowns.',
        'You have not earned a guaranteed elimination. You have kept the threat available without giving the enemy a death that lets them forget the angle. Judge the play by whether your presence still demands attention, not only by the final-hit count.',
      ],
    },
    practiceFocus: 'For one match, notice what the enemy does because you are alive on an angle. Review one death and ask whether a safe reset would have kept that pressure available.',
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
          'A Duelist needs to make the enemy deal with a threat, not simply add damage to the scoreboard. Pressure becomes useful when it changes the fight: a support turns away, a tank gives up space, or an enemy Duelist loses an angle. Those reactions can create an opening for your team even when you do not get the kill yourself.',
          'Look beyond the tank when the frontline exchange is going nowhere. Forcing a defensive ability, a support ultimate, healing resources or attention can disrupt the enemy formation. Damage matters when it helps produce that change; a large total does not establish that it did.',
        ],
      },
      {
        title: 'Why damage stats lie',
        paragraphs: [
          'Repeatedly shooting a tank who is receiving reliable healing can produce impressive numbers while leaving the fight unchanged. There are still good reasons to shoot a tank. The warning is about continuing the same predictable exchange when nobody moves and your team cannot advance.',
          'A threat from another direction changes that calculation. Enemies who must turn, move backward or leave a useful position have more decisions to make and more opportunities to make a mistake. Look for those changes rather than treating extra damage into a stable target as proof of progress.',
        ],
      },
      {
        title: 'Off-angles create the pressure',
        paragraphs: [
          'An off-angle is a second direction of attack: a side lane, high ground or a route toward the backline while your team threatens from the front. If enemies ignore it, an elimination may become available. If they turn to contest it, that attention can give your teammates more room.',
          'The angle is not automatically safe because it is different. Wait for enemy attention to be divided, and notice when a defender is already watching you. Reset a contested attempt instead of teaching yourself that an occasional lucky escape makes the same entry reliable.',
        ],
      },
      {
        title: 'Pressure needs life discipline',
        paragraphs: [
          'Plan the recovery before taking the angle. Know the nearby health pack, the cover that breaks enemy sightlines and the route you can use to leave. When a defender contests you or the situation becomes unfavorable, use that plan while it is still available.',
          'Sometimes the right play is a brief test that forces a reaction and ends with a reset. A scattered enemy team may offer a longer commitment, but you still need to read the fight as it changes. Waiting for the main fight to divide attention is usually a better starting point than demanding a solo opening.',
        ],
      },
      {
        title: 'Main pressure still counts',
        paragraphs: [
          'This is not a requirement to flank every fight. A Duelist can create useful pressure near their tank or through the main lane by threatening exposed targets, disrupting the frontline and helping the team take ground. Choose the position that creates a problem the enemy must answer, rather than farming the nearest tank from whichever route you took.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: change a stalled frontline trade',
      paragraphs: [
        'Your team is repeatedly damaging the enemy tank without gaining ground. You have a side route with cover and a known health pack, and the main fight has drawn enemy attention. Try a short angle that threatens a support rather than repeating the same exchange.',
        'If the support or a defender turns toward you, recognize the attention you have drawn and assess your exit. You do not have to chase a kill to justify the angle. If the route is already contested, reset; if playing near your tank offers the better threat, create pressure there instead.',
      ],
    },
    practiceFocus: 'In your next match, judge one attack by the reaction it forced: movement, attention or a defensive resource. Review whether you left once that useful pressure became an unsafe chase.',
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
          'A fight can begin in your favor and stop being yours before the next elimination. The mistake is continuing because the first few seconds worked, or because one more shot might finish someone. A small overextension can turn a useful opening into a death and a lost trade.',
          'Keep reassessing the current fight rather than defending the decision that started it. Better mechanics cannot make every overstay worthwhile. Knowing when to leave reduces the preventable deaths that erase otherwise good pressure.',
        ],
      },
      {
        title: 'Signs it is time to leave',
        paragraphs: [
          'Reconsider a chase when the kill is uncertain and finishing it now risks your life. Multiple enemies turning their fire toward you, a defender arriving unexpectedly, or a new ability or ultimate can all change the decision. If three players are focusing you, do not assume the original opportunity still exists.',
          'Sometimes the useful outplay is leaving before the dangerous part lands. You will still die sometimes; the aim is to act on a worsening situation instead of waiting for certainty after escape has become impossible.',
        ],
      },
      {
        title: 'Disengage does not mean run forever',
        paragraphs: [
          'A disengage is a reset that can keep your pressure in the fight. Health packs let you recover without pulling your Strategists away from other work, so learn their locations on routes you use to flank or take angles. Breaking sightlines with natural cover can buy the same kind of breathing room.',
          'This is especially important on a hero without strong mobility. Positioning and awareness should do the routine work of keeping an exit available; a movement ability is an emergency option, not a substitute for that plan.',
        ],
      },
      {
        title: 'Reset and re-enter',
        paragraphs: [
          'Back up, stabilize and look for a better entry rather than treating a retreat as the end of your contribution. Some fights require several small resets: leave a position, avoid an ability, then return when attention or resources change. Surviving preserves the chance to create value again, provided you re-enter when a useful opportunity actually appears.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: leave after the first pick',
      paragraphs: [
        'You secure one elimination and follow a second low-health enemy. A defender arrives, another enemy turns toward you, and the escape is becoming harder. The first pick does not make the next chase safe. Break sightlines and recover rather than spending everything to force another finish.',
        'Once you are stable, reassess the same fight from a better position. Re-enter if an opening appears; do not stay away forever simply because the first attempt ended. The decision is about the current threat, not whether the earlier play was successful.',
      ],
    },
    practiceFocus: 'Review the moments immediately after your first elimination in the next match. Identify one changed threat and whether you reset before your exit disappeared.',
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
          'A target choice can become outdated without having been wrong when you made it. The enemy who mattered at the start may no longer be the one stopping your team from winning. Keep reading the fight instead of staying attached to a support, tank or Duelist simply because that was the original plan.',
          'Priority is the target that offers your role the most useful contribution now. There is no fixed order that always places supports first, tanks last or the opposing Duelist above everything else.',
        ],
      },
      {
        title: 'Shoot the problem, not just the visible target',
        paragraphs: [
          'Ask what is keeping the enemy position working. A forward tank who depends on an exposed support line may be less useful to shoot than the support. An uncontested Duelist receiving constant healing may present the same question. However, a tank taking so much space that your team cannot move can be the immediate problem itself.',
          'The answer can also be behind you. A flanker disrupting your backline may matter more than an enemy visible directly ahead. Seeing a target is useful information, but it does not by itself explain why that target should get your attention.',
        ],
      },
      {
        title: 'Do not force priority through bad timing',
        paragraphs: [
          'Identifying a valuable target does not create safe access to it. If a defender peels you away or contests your angle, reset instead of forcing the same route. Keep the preferred target in mind while taking useful shots at someone you can actually reach.',
          'A teammate ultimate may later break the enemy position and create access that did not exist before. Until then, cycle through reachable threats and watch for the opening. Stay committed to solving the fight, not to a single name.',
        ],
      },
      {
        title: 'Peel can be the priority',
        paragraphs: [
          'Peeling means helping a teammate who is under attack. When a diver reaches your Strategists, protecting that support line can be the action that keeps the whole fight playable. It need not produce a flashy kill to be the correct priority. Reassess while helping, and reset if the peel itself becomes an unfavorable trade.',
        ],
      },
      {
        title: 'Three questions for every fight',
        paragraphs: [
          'Build the habit around three questions: what is the biggest problem now, can I reach it safely, and what useful target is available if I cannot? Repeating that scan develops a changing target plan. Memorizing one target order does not.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: the priority moves behind you',
      paragraphs: [
        'You are looking for an angle on an enemy support when a flanker reaches your own Strategists. The planned target still has value, but the immediate problem has changed. Turn to help protect the backline if you can do so without giving away your own life.',
        'After the danger eases, scan again. You may regain the route to the support, or a different reachable target may now offer more value. Do not force the old plan through a defender just because it was correct a few seconds earlier.',
      ],
    },
    practiceFocus: 'During your next match, name the biggest problem and whether you can reach it before committing. In one replayed fight, find the moment that answer changed and check whether your target changed with it.',
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
          'An off-angle gives the enemy a second direction to handle while your team threatens from the front. A side route, high ground or a backline position can create that split. Ignoring you may expose a kill; turning to contest you draws attention away from the main fight. Either way, divided attention can create mistakes your team can use.',
        ],
      },
      {
        title: 'Play your life on the angle',
        paragraphs: [
          'The angle is not permission to feed. Know a health pack route and an escape before entering. If enemies begin collapsing on you, reset rather than spending your life to keep the same spot. Staying alive lets you apply pressure again when the next window opens.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: one defender turns',
      paragraphs: [
        'You take a side angle as your team fights in front. One defender turns toward you. That response is already part of the angle\'s value; it does not oblige you to win a duel. If more enemies collapse on the position, leave through the exit you planned and recover before trying again.',
      ],
    },
    practiceFocus: 'Choose an exit and a health pack before your next off-angle. Review whether you left when the enemy response grew instead of waiting until escape was no longer available.',
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
          'Damage from the same place behind your tank is predictable and easier for supports to heal through. A second angle can make the enemy spend attention, abilities or an ultimate instead. The useful measure is the decision you forced, not just how much damage the scoreboard recorded.',
        ],
      },
      {
        title: 'Take the value and reset',
        paragraphs: [
          'Once you have forced a reaction, do not give it back through greed. Take an elimination if the opening is there, but do not trade your life for extra damage. Recover at a health pack when appropriate and return for another opportunity rather than demanding that one angle win the entire fight.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: a cooldown is enough value',
      paragraphs: [
        'From a second angle, you pressure an enemy into spending a defensive ability. Chasing through their teammates would now put you at risk. Take the resource you forced, reset through your recovery route and look for the next opening. The pressure mattered even if this attempt did not end in a kill.',
      ],
    },
    practiceFocus: 'In one match, notice a defensive resource your angle forces. Check the next few seconds in replay: did you keep that advantage, or give the enemy a trade by staying for more damage?',
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
          'Keep asking whether the fight is still favorable. A low-health enemy is not a reason to chase if you may die for the finish, and one secured kill does not justify staying indefinitely. When the answer changes, abandon the risky trade rather than forcing more value from a fight that has turned against you.',
        ],
      },
      {
        title: 'Health packs are your third support',
        paragraphs: [
          'A reset can be brief: break sightlines with cover, recover at a health pack and re-enter from a stronger position. Learn those recovery routes wherever you flank so every retreat does not demand your Strategists\' attention. The point is to take the next exchange on better terms, not to give up all pressure.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: stop the second chase',
      paragraphs: [
        'After one elimination, you see another low-health opponent moving toward their team. Your own health is low too. Leave the chase, use cover to reach a known health pack and reassess. The first kill remains useful without turning the second attempt into a trade.',
      ],
    },
    practiceFocus: 'After each elimination in the next match, reassess before chasing. Review one time you reset and ask whether it gave you a safer next exchange.',
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
          'If shooting the tank is not changing the fight, look for the problem keeping the enemy position strong. That might be a support sustaining the frontline or a backline Duelist controlling your team. It can also be a different target who becomes reachable in the moment; availability matters alongside the preferred plan.',
        ],
      },
      {
        title: 'Solve the fight in front of you',
        paragraphs: [
          'Do not ignore useful pressure while waiting for a theoretically perfect target. Change your angle, shoot what can help now and watch for the next shift. Target priority is a continuing decision about the current fight, not a promise to keep chasing the same hero.',
        ],
      },
    ],
    workedExample: {
      title: 'Hypothetical: use the target you can reach',
      paragraphs: [
        'You want to pressure a support, but your current angle only gives a safe shot at an exposed enemy Duelist. Take the useful opportunity instead of walking into danger to satisfy the original plan. Reassess as positions change; the support may become available later, or another problem may take priority.',
      ],
    },
    practiceFocus: 'Review one fight where you kept chasing the same target. Find a reachable threat you could have pressured instead, and identify what information would have changed your decision.',
    ultimates: [],
  },
];

export function findHeroGuide(heroId: string | null): HeroGuide | null {
  return HERO_GUIDES.find((guide) => guide.heroId === heroId) ?? null;
}
