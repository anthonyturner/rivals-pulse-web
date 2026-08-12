export type StrategistGuideCategory =
  | 'Fundamentals'
  | 'Ultimate Economy'
  | 'Rocket Raccoon'
  | 'Positioning'
  | 'Decision Making';

export interface StrategistGuide {
  id: string;
  title: string;
  shortTitle: string;
  category: StrategistGuideCategory;
  duration: string;
  youtubeId: string;
  heroFocus: string;
  heroImage: string;
  summary: string;
  outcome: string;
  sourceEra: string;
  principles: Array<{
    title: string;
    body: string;
  }>;
  decisionRules: Array<{
    when: string;
    action: string;
  }>;
  checkpoints: Array<{
    time: string;
    label: string;
    note: string;
  }>;
  drills: Array<{
    title: string;
    instructions: string;
    success: string;
  }>;
  reviewQuestions: string[];
}

export const STRATEGIST_PLAYLIST_URL =
  'https://www.youtube.com/playlist?list=PLIM5w_aKBOQaZxjgn8ikb-vnajoyfD4Xw';

export const STRATEGIST_GUIDES: StrategistGuide[] = [
  {
    id: 'carrying-with-confidence',
    title: 'Carrying With Confidence as Strategist',
    shortTitle: 'Carry With Confidence',
    category: 'Fundamentals',
    duration: '21:06',
    youtubeId: 'p4E6YgnnVvs',
    heroFocus: 'Luna Snow',
    heroImage: '/images/heroes/luna-snow.png',
    summary:
      'Turn safe positioning into proactive pressure. This guide explains how a Strategist can move with an advantage, help secure eliminations, and still remain the hardest target on the team to reach.',
    outcome:
      'You will know when to advance, when to stabilize, and how to contribute damage without abandoning teammates who are actually in danger.',
    sourceEra:
      'The match examples use the hero kits and balance state shown in the source video. Apply the decision framework first and verify current ability values in-game.',
    principles: [
      {
        title: 'Move from cover to cover',
        body:
          'Keep allies in your line of sight while denying sightlines to the most dangerous enemy. A safe position is not merely far away; it has nearby cover and another position ready when the fight moves.',
      },
      {
        title: 'Let the kill feed set your confidence',
        body:
          'Play reserved in an even fight. Walk forward after a pick, a major enemy cooldown, or a friendly ultimate creates an advantage. If your team loses two players, leave before the stagger begins.',
      },
      {
        title: 'Heal danger, not missing health',
        body:
          'A stable teammate with most of their health can wait while you pressure a vulnerable enemy. A teammate who is critical, isolated, or actively focused becomes the immediate healing priority.',
      },
      {
        title: 'Change risk by objective phase',
        body:
          'Offense often needs a pick to open the objective, so controlled aggression matters. Defense already owns the win condition; survival, contest time, and denying the enemy play are usually more valuable than a risky chase.',
      },
    ],
    decisionRules: [
      {
        when: 'Your team gets the first elimination',
        action: 'Advance with the frontline, keep cover available, and help turn one pick into staggers.',
      },
      {
        when: 'A teammate is stable and an enemy squishy is exposed',
        action: 'Weave damage or crowd control through the frontline instead of topping off harmless chip damage.',
      },
      {
        when: 'You are down two players',
        action: 'Stop contributing to the current fight and rotate out before the enemy can stagger you.',
      },
      {
        when: 'A diver reaches you',
        action: 'Defend yourself first, rotate toward safety, and resume team healing after the immediate threat is controlled.',
      },
    ],
    checkpoints: [
      {
        time: '00:40',
        label: 'Safe opening route',
        note: 'Zigzag between cover while the enemy composition is still unknown.',
      },
      {
        time: '04:25',
        label: 'Recognize a lost fight',
        note: 'Two allied deaths trigger an immediate retreat instead of a hopeful stagger.',
      },
      {
        time: '06:41',
        label: 'Convert the advantage',
        note: 'Track living players, advance with the tanks, and keep the dangerous Hawkeye outside your sightline.',
      },
      {
        time: '09:09',
        label: 'Offense versus defense',
        note: 'The objective phase changes how much risk a Strategist should accept.',
      },
    ],
    drills: [
      {
        title: 'Kill-feed movement',
        instructions:
          'For three matches, say “forward,” “hold,” or “back” after every elimination and move to the next piece of cover accordingly.',
        success: 'You stop being the final death in lost fights and arrive sooner when your team earns an advantage.',
      },
      {
        title: 'Threat sightline audit',
        instructions:
          'Before each fight, name the enemy most capable of eliminating you and choose a position that blocks that hero while preserving allied line of sight.',
        success: 'The primary enemy threat must spend movement or cooldowns before they can see you.',
      },
      {
        title: 'One damage window',
        instructions:
          'In every fight, identify one moment when all endangered allies are stable and contribute deliberate damage to a squishy or deployable.',
        success: 'Your damage happens during a safe window and never causes a preventable allied death.',
      },
    ],
    reviewQuestions: [
      'Did I move before or after my frontline began retreating?',
      'Which enemies could see me at the moment I took the most damage?',
      'Did I heal harmless missing health while a better pressure target was available?',
      'Was my aggression justified by numbers, resources, or objective state?',
    ],
  },
  {
    id: 'ult-efficiency-101',
    title: 'Ultimate Efficiency 101',
    shortTitle: 'Ultimate Efficiency',
    category: 'Ultimate Economy',
    duration: '16:40',
    youtubeId: 'UG-aIKooBMs',
    heroFocus: 'Rocket Raccoon',
    heroImage: '/images/heroes/rocket-raccoon.png',
    summary:
      'Treat an ultimate as a tempo tool instead of a trophy. The guide connects ultimate timing to objective progress, staggers, survival, and the opportunity to begin charging the next ultimate.',
    outcome:
      'You will use Strategist ultimates often enough to control momentum without stacking them carelessly or waiting forever for a perfect counter.',
    sourceEra:
      'Ultimate charge rates and individual effects are patch-sensitive. The objective and tempo questions remain useful across balance updates.',
    principles: [
      {
        title: 'Spend for momentum',
        body:
          'An ultimate can start a winning push, protect an existing advantage, or stop the enemy from building one. It does not need to counter another ultimate to create fight-winning value.',
      },
      {
        title: 'Use the objective as the scoreboard',
        body:
          'On Domination, ask whether the ultimate preserves percentage and reduces the number of future fights. On Convoy, ask whether it keeps the vehicle moving or prevents the enemy from moving it.',
      },
      {
        title: 'An unused ultimate stops charging',
        body:
          'Once ultimate charge is full, every heal or damage event loses potential charge toward the next one. A good, timely use can be stronger than a theoretically perfect use several fights later.',
      },
      {
        title: 'Coordinate the sequence',
        body:
          'Call which support ultimate goes first. Preserve the second layer when one ultimate is already enough, but do not let fear of overlap become hesitation that loses the objective.',
      },
    ],
    decisionRules: [
      {
        when: 'Your team earns a 6v5 and can stagger the retreat',
        action: 'Use an offensive ultimate if it safely converts the advantage into objective time.',
      },
      {
        when: 'Your team controls a Domination point and is about to break',
        action: 'Spend to preserve control or reach a decisive percentage rather than saving for a later retake.',
      },
      {
        when: 'A teammate has already committed a sufficient support ultimate',
        action: 'Hold yours, communicate the next layer, and use the active protection to build charge or damage.',
      },
      {
        when: 'You are low and your death would collapse the remaining defense',
        action: 'Use the ultimate to survive and maintain uptime even if the setup is not visually impressive.',
      },
    ],
    checkpoints: [
      {
        time: '00:20',
        label: 'The charge-cycle problem',
        note: 'Holding at full charge sacrifices progress toward the next ultimate.',
      },
      {
        time: '06:21',
        label: 'Turn a 6v5 into a full stagger',
        note: 'A fast Rocket ultimate wins time and starts the next charge cycle.',
      },
      {
        time: '10:20',
        label: 'Prediction can miss',
        note: 'A mistaken follow-up is reviewed as a learning event rather than a reason to stop acting proactively.',
      },
      {
        time: '15:27',
        label: 'Objective value over perfection',
        note: 'Frequent uses preserve momentum and teach better timing faster.',
      },
    ],
    drills: [
      {
        title: 'Ten-second plan',
        instructions:
          'When you reach 90% ultimate charge, state the next fight condition that will make you press it.',
        success: 'You enter the fight with a plan and spend within ten seconds of the condition occurring.',
      },
      {
        title: 'Objective translation',
        instructions:
          'After each ultimate, record the objective result: percentage gained, distance moved, enemy ultimates forced, or teammates saved.',
        success: 'Every use has a concrete tempo result instead of only a healing or damage number.',
      },
      {
        title: 'Support-ult sequence',
        instructions:
          'Before the fight, tell the other Strategist who uses first and what event triggers the second.',
        success: 'Your team avoids accidental overlap without hesitating through a losing fight.',
      },
    ],
    reviewQuestions: [
      'How long did I remain at full charge before using the ultimate?',
      'What objective time did the ultimate buy?',
      'Did I spend after the fight was already lost?',
      'Could I realistically have charged another ultimate during the time I held this one?',
    ],
  },
  {
    id: 'rocket-to-celestial',
    title: 'Rocket to Celestial Guide',
    shortTitle: 'Rocket to Celestial',
    category: 'Rocket Raccoon',
    duration: '41:51',
    youtubeId: '262484UMVbA',
    heroFocus: 'Rocket Raccoon',
    heroImage: '/images/heroes/rocket-raccoon.png',
    summary:
      'A full Rocket game plan built around uptime, creative movement, resurrection placement, shot-calling, sustained healing, and amplifier timing.',
    outcome:
      'You will understand why Rocket’s skill expression comes from movement and tempo—and how to turn survival into more healing, more ultimates, and more objective control.',
    sourceEra:
      'The video discusses a specific ranked season and its Rocket–Peni Team-Up. Treat balance values and Team-Up details as historical; use the movement, placement, and tempo concepts as the durable lesson.',
    principles: [
      {
        title: 'Uptime is Rocket’s carry stat',
        body:
          'Wall movement and long rotations let Rocket survive dives that would demand peel on another Strategist. Staying alive produces more healing, more resurrection coverage, more shot-calls, and more ultimate cycles.',
      },
      {
        title: 'Sustain from geometry',
        body:
          'Bounce healing orbs around corners, through grouped allies, and near their feet when the geometry allows it. Rocket supports scattered teammates without exposing himself to every enemy sightline.',
      },
      {
        title: 'Hide value, not merely the deployable',
        body:
          'Move resurrection stations between unexpected but reachable locations. Place the amplifier where enemies must choose between looking at it and looking at your team, often above or behind cover.',
      },
      {
        title: 'Call the fight from the back',
        body:
          'A safe Strategist sees flank routes, low teammates, ultimate states, and the frontline’s retreat. Use that information to call when the team should give space, regroup, or convert a pick.',
      },
    ],
    decisionRules: [
      {
        when: 'The fight is an even 6v6 with heavy incoming pressure',
        action: 'Prioritize sustained healing and information until a clear damage window appears.',
      },
      {
        when: 'Your team earns the first pick',
        action: 'Move forward, add damage, and consider amplifier to lock the numbers advantage.',
      },
      {
        when: 'The enemy uses a defensive support ultimate you cannot match',
        action: 'Kite, sustain from range, and re-engage as the effect expires rather than feeding into it.',
      },
      {
        when: 'Resurrection station becomes predictable or exposed',
        action: 'Destroy or relocate it during downtime and vary the next placement.',
      },
    ],
    checkpoints: [
      {
        time: '00:40',
        label: 'Why Rocket fits the role',
        note: 'The opening explains shot-calling, self-sufficiency, resurrection, movement, sustain, damage, and tempo.',
      },
      {
        time: '07:27',
        label: 'Rollout and station habits',
        note: 'Use wall movement to return faster and avoid repeating the same resurrection placement.',
      },
      {
        time: '09:09',
        label: 'Defensive amplifier',
        note: 'A hidden placement isolates a diver and converts the fight into a 6v5.',
      },
      {
        time: '34:52',
        label: 'Read before entering',
        note: 'Let the frontline reveal the enemy setup, then choose station depth and healing position.',
      },
      {
        time: '38:13',
        label: 'Survival compounds',
        note: 'Low deaths become uptime, charge, resources, and objective control.',
      },
    ],
    drills: [
      {
        title: 'Three wall routes',
        instructions:
          'In practice range or a custom lobby, find a forward route, retreat route, and vertical sightline route on each map section.',
        success: 'You can execute each route without spending every movement charge.',
      },
      {
        title: 'Station variation',
        instructions:
          'Use a different reachable resurrection location after every activation or discovery.',
        success: 'Enemies must actively search rather than prefire the same placement.',
      },
      {
        title: 'Amplifier geometry',
        instructions:
          'Before each ultimate, identify a high or covered placement that reaches allies without giving the enemy a clean firing lane.',
        success: 'The amplifier survives long enough to secure a pick, force space, or win the objective exchange.',
      },
    ],
    reviewQuestions: [
      'Was I near geometry that improved both my healing angle and escape?',
      'Did my resurrection placement return an ally to a winnable fight or merely create another stagger?',
      'Did I use amplifier to create momentum or only react after losing it?',
      'What useful information could I have called from my backline view?',
    ],
  },
  {
    id: 'holding-strategist-ults',
    title: 'Holding Strategist Ultimates Can Lose the Game',
    shortTitle: 'Stop Holding Support Ults',
    category: 'Ultimate Economy',
    duration: '8:14',
    youtubeId: 'kCxNFub0DBg',
    heroFocus: 'All Strategists',
    heroImage: '/images/heroes/invisible-woman.png',
    summary:
      'A focused comparison of one delayed support ultimate and one proactive chain of ultimates, showing how objective control—not the size of the highlight—defines value.',
    outcome:
      'You will recognize when spending an ultimate in a disadvantaged fight is correct because it buys percentage, respawns, or a simpler final fight.',
    sourceEra:
      'Individual ultimate interactions can change. The guide focuses on fight count, objective percentage, and respawn timing.',
    principles: [
      {
        title: 'Holding the point is easier than retaking it',
        body:
          'If a support ultimate preserves existing control, it may remove an entire future fight from the win condition. Losing the point while holding the answer creates a much harder retake.',
      },
      {
        title: 'Stall can be winning value',
        body:
          'Using an ultimate while down players looks wrong if the only goal is eliminations. It becomes correct when the effect buys enough time for respawns, more percentage, or the next friendly ultimate.',
      },
      {
        title: 'Chain resources, do not pile them',
        body:
          'One support ultimate can bridge into a returning teammate’s ultimate. Sequencing forces the enemy to spend resources over a longer period and gives your team another fight layer.',
      },
      {
        title: 'Momentum is the real target',
        body:
          'Saving lives and securing eliminations matter because they preserve objective control. Evaluate the ultimate by the momentum it protects or creates.',
      },
    ],
    decisionRules: [
      {
        when: 'You own a Domination point and the enemy commits support ultimates',
        action: 'Answer early enough to keep teammates alive and continue building percentage.',
      },
      {
        when: 'You are down players but respawns can return during the ultimate',
        action: 'Spend to bridge the gap if holding the objective reduces the fights needed to win.',
      },
      {
        when: 'The enemy has already won the fight and no objective time can be saved',
        action: 'Reset and keep the ultimate for the organized retake.',
      },
      {
        when: 'You are holding only for one named enemy ultimate',
        action: 'Reassess whether the current fight or objective will be lost before that counter opportunity arrives.',
      },
    ],
    checkpoints: [
      {
        time: '01:25',
        label: 'Hesitation loses control',
        note: 'The available answer arrives too late, teammates die, and the point flips.',
      },
      {
        time: '04:18',
        label: 'Ult while down players',
        note: 'A 3v6 stall is valuable because respawns and another support ultimate are close.',
      },
      {
        time: '06:32',
        label: 'Enemy resources forced',
        note: 'The extended stall makes the eventual flip expensive and enables an immediate retake.',
      },
      {
        time: '07:01',
        label: 'The objective test',
        note: 'Every ultimate question returns to control, percentage, distance, and future fight count.',
      },
    ],
    drills: [
      {
        title: 'Fight-count callout',
        instructions:
          'At 50%, 80%, and 95% objective progress, say how many clean fights each team likely needs.',
        success: 'Your ultimate decisions change when preserving control removes a future fight.',
      },
      {
        title: 'Respawn bridge',
        instructions:
          'Before stalling, check the respawn icons and identify exactly who can return during your effect.',
        success: 'You only spend in a disadvantaged fight when the stall connects to real reinforcements.',
      },
      {
        title: 'Counter-release rule',
        instructions:
          'If you are holding for one enemy ultimate, define a second trigger that releases your ultimate first.',
        success: 'You retain counterplay without watching teammates die while the answer remains unused.',
      },
    ],
    reviewQuestions: [
      'How much objective percentage was available when I chose to hold?',
      'Could a teammate have returned during my ultimate?',
      'Did holding create a harder retake than spending would have created?',
      'Which enemy resources were forced by our stall?',
    ],
  },
  {
    id: 'rocket-guide-part-2-damage',
    title: 'Rocket Guide Part 2: Dealing Damage',
    shortTitle: 'Rocket Damage Windows',
    category: 'Rocket Raccoon',
    duration: '27:20',
    youtubeId: 'Fd1UoaOFkWo',
    heroFocus: 'Rocket Raccoon',
    heroImage: '/images/heroes/rocket-raccoon.png',
    summary:
      'Learn the calculated windows where Rocket should stop healing and add damage: numbers advantages, friendly support ultimates, isolated targets, deployables, flanks, and objective stalls.',
    outcome:
      'You will add pressure without turning every fight into a reckless duel or leaving a critical ally unattended.',
    sourceEra:
      'Damage values and amplifier strength are patch-sensitive. The guide’s danger checks and target-selection rules are the transferable lesson.',
    principles: [
      {
        title: 'Damage is conditional',
        body:
          'Rocket deals damage when allies are stable, a target is isolated, a friendly ultimate supplies sustain, or the team already owns a numbers advantage. Healing returns immediately when a teammate becomes critical.',
      },
      {
        title: 'Defense and offense ask for different output',
        body:
          'Defense can win through survival and time, so long-range healing is often sufficient. Offense needs eliminations to cross chokes, making off-angles and coordinated damage more important.',
      },
      {
        title: 'Pressure includes objects and space',
        body:
          'Destroy resurrection stations, ankhs, walls, nests, and other deployables when enemy healing prevents hero eliminations. Damage can also force a tank away from the exact space needed to contest.',
      },
      {
        title: 'A single elimination can justify an ultimate',
        body:
          'Securing the isolated support or tank that controls the objective is enough. The goal is not maximum damage; it is a decisive numbers advantage.',
      },
    ],
    decisionRules: [
      {
        when: 'An ally falls below half health and remains under pressure',
        action: 'Stop the damage attempt and stabilize them.',
      },
      {
        when: 'A friendly support ultimate is active and allies are safe',
        action: 'Use the protection to damage targets or remove enemy deployables.',
      },
      {
        when: 'An isolated enemy lacks a key defensive cooldown',
        action: 'Take the calculated duel only if your escape and team state remain secure.',
      },
      {
        when: 'One enemy is stalling the objective',
        action: 'Focus the staller instead of chasing lower-value enemies away from the win condition.',
      },
    ],
    checkpoints: [
      {
        time: '03:47',
        label: 'Calculated duel',
        note: 'Key cooldown information and nearby geometry make the Hela fight reasonable.',
      },
      {
        time: '13:29',
        label: 'Value during enemy sustain',
        note: 'Remove deployables and build crossfire when hero damage cannot yet secure a kill.',
      },
      {
        time: '16:10',
        label: 'Offensive support flank',
        note: 'Rocket follows Peni, sustains the off-angle, and helps pull the frontline apart.',
      },
      {
        time: '23:00',
        label: 'Kill the objective threat',
        note: 'Damage the hero contesting the payload instead of chasing enemies outside.',
      },
      {
        time: '25:12',
        label: 'Ultimate for one support',
        note: 'The isolated target and immediate win condition make the spend worthwhile.',
      },
    ],
    drills: [
      {
        title: 'Damage permission check',
        instructions:
          'Before holding primary fire, check ally health, active threats, your escape, and the numbers state.',
        success: 'You can name at least two reasons the damage window is safe.',
      },
      {
        title: 'Deployable sweep',
        instructions:
          'During enemy sustain ultimates, scan for destructible utility before shooting an unkillable hero.',
        success: 'Your team exits the sustain window with fewer enemy resources to clear.',
      },
      {
        title: 'Objective target lock',
        instructions:
          'In overtime or at a checkpoint, identify the exact enemy preventing progress and keep damage on that target.',
        success: 'You do not abandon the objective to chase an unrelated low-health enemy.',
      },
    ],
    reviewQuestions: [
      'What made each damage window safe?',
      'Did a teammate become critical while I continued shooting?',
      'Could destroying a deployable have created more value than damaging a hero?',
      'Did my off-angle split attention while preserving an escape?',
    ],
  },
  {
    id: 'rocket-guide-part-1-potential',
    title: 'Rocket Guide Part 1: Maximize His Potential',
    shortTitle: 'Rocket Movement & Placement',
    category: 'Rocket Raccoon',
    duration: '21:02',
    youtubeId: 'pJcCiHHgwV0',
    heroFocus: 'Rocket Raccoon',
    heroImage: '/images/heroes/rocket-raccoon.png',
    summary:
      'Rocket’s floor is simple, but his ceiling lives in wall movement, geometry-aware healing, fast rollouts, safe resurrection coverage, and creative amplifier placement.',
    outcome:
      'You will build map routes that turn one movement charge into a long escape or sightline change while keeping healing uptime high.',
    sourceEra:
      'The movement demonstration reflects the Rocket version in the source video. Test the current distances and collision behavior before relying on an exact rollout.',
    principles: [
      {
        title: 'Attach, then boost',
        body:
          'Using a wall before the movement burst can produce far more distance than a flat ground dash. The technique works vertically and laterally, and wall running can cover ground quickly.',
      },
      {
        title: 'Position beside useful geometry',
        body:
          'Every healing position should have a wall or cover piece that also functions as an escape route. Long, clean surfaces are more reliable than walls with irregular collision.',
      },
      {
        title: 'Heal through the formation',
        body:
          'Line up or bounce healing orbs so they pass through multiple allies. Rocket provides sustained team healing from a location that keeps him outside the main damage lane.',
      },
      {
        title: 'Place the amplifier above the choice',
        body:
          'A high placement can remain in range while forcing enemies to look away from your team and suffer damage falloff. Plan the location before charge reaches 100%.',
      },
    ],
    decisionRules: [
      {
        when: 'You need to return from spawn',
        action: 'Use known wall routes to reduce downtime and establish resurrection coverage early.',
      },
      {
        when: 'A mobile ally dives beyond safe line of sight',
        action: 'Trust their escape instead of abandoning your safe position to chase them.',
      },
      {
        when: 'A low teammate is escaping and you still have full health',
        action: 'Use cover first; body-block only when your health can safely absorb the final incoming shots.',
      },
      {
        when: 'Amplifier charge approaches full',
        action: 'Preselect a covered or elevated surface that reaches the fight and is awkward to destroy.',
      },
    ],
    checkpoints: [
      {
        time: '00:40',
        label: 'Ground dash versus wall boost',
        note: 'The opening demonstration shows why geometry is the center of Rocket movement.',
      },
      {
        time: '04:52',
        label: 'Fast return route',
        note: 'Wall movement cuts downtime after a death and restores team support sooner.',
      },
      {
        time: '07:17',
        label: 'Backline information',
        note: 'Safe positioning gives the Strategist the view needed to call the enemy rotation.',
      },
      {
        time: '09:08',
        label: 'Rollout into early station',
        note: 'Movement creates a forward, protected resurrection placement before the fight develops.',
      },
      {
        time: '11:33',
        label: 'Elevated amplifier geometry',
        note: 'The sphere reaches the fight while forcing enemies to choose where to aim.',
      },
    ],
    drills: [
      {
        title: 'Wall-tech circuit',
        instructions:
          'Choose five long walls and practice launching up, left, right, and backward without catching on nearby collision.',
        success: 'You can use one charge to reach the planned cover consistently.',
      },
      {
        title: 'Multi-ally orb',
        instructions:
          'Position so each healing shot passes through or bounces into at least two teammates.',
        success: 'You sustain the formation without stepping into the frontline lane.',
      },
      {
        title: 'Preplanned amplifier',
        instructions:
          'At 80% charge, mark one elevated and one covered placement before the next fight.',
        success: 'You place immediately when the trigger arrives instead of searching while teammates fight.',
      },
    ],
    reviewQuestions: [
      'Did I spend multiple charges where one wall-assisted movement would work?',
      'Which wall collision interrupted my route?',
      'Could my healing angle have reached more than one ally?',
      'Did the amplifier force enemies to change their aim or position?',
    ],
  },
  {
    id: 'strategist-positioning-vs-dive',
    title: 'Dive Only Works if They Catch You',
    shortTitle: 'Positioning Against Dive',
    category: 'Positioning',
    duration: '15:14',
    youtubeId: 'dxaVk47DxCo',
    heroFocus: 'Rocket Raccoon',
    heroImage: '/images/heroes/rocket-raccoon.png',
    summary:
      'Beat dive through prediction, route planning, and burst survival. The Strategist does not need to eliminate every flanker; wasting their timing and forcing an exit is already a win.',
    outcome:
      'You will choose matchup-specific cover, rotate before the dive lands, and preserve enough health and cooldowns to resume supporting the team.',
    sourceEra:
      'Hero combos and cooldowns may change. Recheck current kits, then apply the same process: predict entry, survive burst, and punish the exit.',
    principles: [
      {
        title: 'Rotate before contact',
        body:
          'If a flanker has been missing long enough to set up, assume they are approaching. Move toward the opposite side of the fight before their combo begins.',
      },
      {
        title: 'Match the cover to the diver',
        body:
          'High ground taxes some heroes but helps an aerial Spider-Man. Interior corners, walls, ledges, and drop routes should be selected around the enemy’s actual movement pattern.',
      },
      {
        title: 'Survive the burst, then answer',
        body:
          'Use healing, cover, and movement during the enemy’s strongest damage window. Once key abilities are spent, apply enough damage or crowd control to force the diver away.',
      },
      {
        title: 'Wasted dive time is team value',
        body:
          'A diver chasing you without earning a kill is absent from the frontline. Continue healing when possible, call their position, and let teammates punish the overextension.',
      },
    ],
    decisionRules: [
      {
        when: 'A flanker has disappeared from the main fight',
        action: 'Move near a planned escape, listen for the entry, and warn the other Strategist.',
      },
      {
        when: 'The diver begins the burst combo',
        action: 'Break line of sight and prioritize survival instead of trying to out-damage the opening.',
      },
      {
        when: 'The burst ends and the diver remains',
        action: 'Damage or crowd-control them to force an exit while staying close to cover.',
      },
      {
        when: 'You cannot see or hear the threat',
        action: 'Avoid exposed positions and scan the likely flank route before returning attention to the frontline.',
      },
    ],
    checkpoints: [
      {
        time: '00:38',
        label: 'Tax the entry',
        note: 'The first position forces dive heroes to spend movement before they can interact.',
      },
      {
        time: '01:43',
        label: 'Missing flanker prediction',
        note: 'Spider-Man has been absent long enough that the next dive should be expected.',
      },
      {
        time: '02:40',
        label: 'Survive, then pressure',
        note: 'Cover avoids the burst and return damage forces Spider-Man to leave.',
      },
      {
        time: '05:30',
        label: 'The unseen dive succeeds',
        note: 'The only early death comes from a Psylocke entry that was not detected or predicted.',
      },
      {
        time: '12:03',
        label: 'Think through the enemy kit',
        note: 'Different divers demand different routes, cover shapes, and timing.',
      },
    ],
    drills: [
      {
        title: 'Three-exit positioning',
        instructions:
          'At each setup, point out a left route, right route, and vertical or backward route before the fight begins.',
        success: 'You never discover your escape only after the dive lands.',
      },
      {
        title: 'Missing-flanker timer',
        instructions:
          'When a dive hero leaves your view, count several seconds and perform a flank scan before returning to healing.',
        success: 'You begin rotating before the majority of dive attempts connect.',
      },
      {
        title: 'Burst discipline',
        instructions:
          'During the first enemy combo, use movement and survival tools only; return damage after the key cooldowns miss or expire.',
        success: 'The diver exits or dies while you remain able to support the next phase.',
      },
    ],
    reviewQuestions: [
      'How long had the diver been missing before they reached me?',
      'Was my cover shape appropriate for that hero’s movement?',
      'Did I fight during the enemy burst instead of surviving it?',
      'How much time did the diver spend chasing me without value?',
    ],
  },
  {
    id: 'win-through-better-positioning',
    title: 'Win Through Better Positioning: Strategist Edition',
    shortTitle: 'Strategist Positioning',
    category: 'Positioning',
    duration: '42:36',
    youtubeId: 'NZujWb2xbZA',
    heroFocus: 'Luna Snow',
    heroImage: '/images/heroes/luna-snow.png',
    summary:
      'A complete positioning framework: stay within useful range but outside shared danger, move with the numbers advantage, limit incoming angles, and make every aggressive step a calculated risk.',
    outcome:
      'You will reduce deaths from combined damage and remain available for more fights without becoming a passive healbot.',
    sourceEra:
      'The guide emphasizes universal positioning. Specific hero abilities shown in the VOD should still be checked against the current patch.',
    principles: [
      {
        title: 'Near the team, not inside the team',
        body:
          'Stay close enough to heal and receive help, but far enough that a flanker must cross controlled space to reach you. Clumping lets the enemy damage the frontline and Strategist with the same angle.',
      },
      {
        title: 'Push and pull with the count',
        body:
          'Walk forward when your team gains players and retreat as soon as the count turns. Do not wait until the tanks have backed all the way into your position.',
      },
      {
        title: 'Limit simultaneous damage sources',
        body:
          'Many deaths are not one perfect combo; they are one major hit plus chip damage from several angles. Use cover to let only the target you are addressing see you.',
      },
      {
        title: 'Impact is contextual',
        body:
          'Low deaths, timely final hits, threat denial, and critical healing can win more fights than a larger raw healing number. Judge the action by whether it changed the fight.',
      },
    ],
    decisionRules: [
      {
        when: 'Your frontline advances after a pick',
        action: 'Take the next safe position with them while preserving distance and an exit.',
      },
      {
        when: 'The enemy uses sustain you cannot overcome',
        action: 'Give space, keep allies in range, and prepare the counterattack as the effect expires.',
      },
      {
        when: 'A healthy ally is inside dangerous enemy line of sight',
        action: 'Do not expose yourself merely to top them off; preserve your life and heal when the sightline closes.',
      },
      {
        when: 'An ally takes an isolated position with no safe route for you',
        action: 'Call the problem but do not turn one positioning error into two deaths.',
      },
    ],
    checkpoints: [
      {
        time: '01:20',
        label: 'Formation spacing',
        note: 'The overhead explanation separates frontline, off-angles, and Strategist range.',
      },
      {
        time: '03:44',
        label: 'Retreat with the count',
        note: 'The backline moves at the same time as the tanks instead of becoming the last target.',
      },
      {
        time: '08:21',
        label: 'Predict incoming damage',
        note: 'Rotating before an ultimate or flank is safer than reacting after the hit lands.',
      },
      {
        time: '12:35',
        label: 'Combined damage kills',
        note: 'Cover isolates the Psylocke duel from Magneto and Emma pressure.',
      },
      {
        time: '38:30',
        label: 'Create a second attack lane',
        note: 'Avoid the obvious portal path and pressure from an unexpected safe angle.',
      },
    ],
    drills: [
      {
        title: 'One-enemy exposure',
        instructions:
          'Choose positions where only the enemy you are actively addressing can see you.',
        success: 'Review shows fewer deaths caused by two or more simultaneous damage sources.',
      },
      {
        title: 'Frontline spacing',
        instructions:
          'Maintain one safe-position gap behind the frontline and move that gap as the tanks advance or retreat.',
        success: 'You remain in healing range without sharing the frontline’s incoming damage.',
      },
      {
        title: 'Calculated off-angle',
        instructions:
          'Take one off-angle only after confirming ally line of sight, enemy threats, and a return route.',
        success: 'The angle splits attention or secures pressure without forcing your team to rescue you.',
      },
    ],
    reviewQuestions: [
      'How many enemies could damage me at each death?',
      'Did I retreat early enough to preserve the spacing behind my frontline?',
      'Which ally did I follow into a position that was unsafe for my hero?',
      'What fight value did my healing create beyond increasing the scoreboard number?',
    ],
  },
  {
    id: 'heal-vs-damage',
    title: 'When to Heal Versus When to Do Damage',
    shortTitle: 'Heal vs. Damage',
    category: 'Decision Making',
    duration: '1:02:48',
    youtubeId: 'HCXuJM8su3E',
    heroFocus: 'Cloak & Dagger',
    heroImage: '/images/heroes/cloak-and-dagger.png',
    summary:
      'A long-form lesson on damage weaving, triage, resource pressure, and rank adaptation, using Cloak & Dagger to show why a Strategist must use the whole kit.',
    outcome:
      'You will make a fast danger assessment before each heal or damage choice and adapt the balance as enemy pressure becomes faster and more coordinated.',
    sourceEra:
      'The opening rank percentages are illustrative, not a required formula. Current Cloak & Dagger values may differ; use the danger and opportunity checks rather than fixed output ratios.',
    principles: [
      {
        title: 'Adapt output to the lobby',
        body:
          'Lower-pressure games leave larger windows to create eliminations yourself. As enemy damage becomes faster and teammates are punished sooner, healing and preemptive mitigation consume more of your attention.',
      },
      {
        title: 'Triage danger, not the health bar alone',
        body:
          'A nearly full tank in a chaotic fight often needs help killing the immediate threat more than the final sliver of health. A lower ally in cover may be safer than a healthier ally currently focused by multiple enemies.',
      },
      {
        title: 'Use the full hero cycle',
        body:
          'Cloak’s pressure and amplification exist alongside Dagger’s healing. Switching forms and using independent cooldowns creates more value than remaining on one form because it feels safe.',
      },
      {
        title: 'Pressure pulls resources',
        body:
          'Damage does not need to secure the elimination immediately. Forcing an enemy support ultimate, escape, or defensive cooldown can make the next objective fight much easier.',
      },
    ],
    decisionRules: [
      {
        when: 'An ally is critical, exposed, or actively focused',
        action: 'Heal or mitigate immediately, especially if they lack their own escape.',
      },
      {
        when: 'Allies are stable and a vulnerable enemy or deployable is available',
        action: 'Switch to damage or amplification until the danger state changes.',
      },
      {
        when: 'Friendly sustain covers the team',
        action: 'Use the temporary safety to pressure, blind, amplify, or secure eliminations.',
      },
      {
        when: 'A diver commits to you',
        action: 'Use survival resources and fight back; the frontline must self-manage until you are safe.',
      },
    ],
    checkpoints: [
      {
        time: '00:20',
        label: 'Rank changes the balance',
        note: 'The required healing-to-damage mix increases as incoming pressure becomes faster.',
      },
      {
        time: '05:27',
        label: 'Friendly sustain enables pressure',
        note: 'The active ultimate covers healing while Cloak attacks and separates the enemy support.',
      },
      {
        time: '09:14',
        label: 'Offensive ultimate timing',
        note: 'An early use creates safety, pressure, and a pincer before the enemy can stabilize.',
      },
      {
        time: '47:16',
        label: 'Rapid weave example',
        note: 'Bubble, damage, healing, and target selection change repeatedly with the fight state.',
      },
      {
        time: '57:35',
        label: 'Force the support ultimate',
        note: 'Damage amplification pulls Luna’s ultimate before the decisive objective moment.',
      },
      {
        time: '58:46',
        label: 'The triage summary',
        note: 'Heal allies in real danger; otherwise help remove the threat in front of them.',
      },
    ],
    drills: [
      {
        title: 'Two-second danger scan',
        instructions:
          'Before switching to damage, check ally health, cover, enemy attention, and available defensive cooldowns.',
        success: 'You can explain why the ally was safe for the next two seconds.',
      },
      {
        title: 'Full-kit cycle',
        instructions:
          'Use at least one healing tool and one pressure tool during every organized fight.',
        success: 'Neither form nor a major cooldown remains unused simply because you defaulted to healbotting.',
      },
      {
        title: 'Resource-forcing log',
        instructions:
          'Record enemy escapes, defensive cooldowns, and ultimates forced by your pressure.',
        success: 'You begin valuing pressure that creates the next winning window even when it earns no final hit.',
      },
    ],
    reviewQuestions: [
      'Was the ally actually in danger, or merely missing health?',
      'Which offensive cooldown remained unused while I healed?',
      'Did my pressure force a resource before the objective fight?',
      'Has the lobby’s damage speed changed enough that I need to adjust my healing priority?',
    ],
  },
  {
    id: 'support-and-carry',
    title: 'How to Support and Carry Your Games',
    shortTitle: 'Support & Carry',
    category: 'Fundamentals',
    duration: '36:59',
    youtubeId: 'C57isBTug1g',
    heroFocus: 'Rocket Raccoon',
    heroImage: '/images/heroes/rocket-raccoon.png',
    summary:
      'A practical support loop: minimize downtime, pre-heal predictable damage, keep key utility active, enable the teammate who can win the fight, and switch instantly between healing, damage, and retreat.',
    outcome:
      'You will support the real win condition in each moment rather than chasing raw healing, perfect deployable placement, or a rigid idea of the meta.',
    sourceEra:
      'This older match includes previous Rocket mechanics and seasonal tuning. Treat exact abilities and charge speed as historical examples; positioning, priority, and downtime remain the focus.',
    principles: [
      {
        title: 'Minimize downtime',
        body:
          'A good-enough deployable placed quickly is often better than a perfect one found while teammates fight without you. Use movement to place, return, and resume output with as little dead time as possible.',
      },
      {
        title: 'Pre-heal predictable pressure',
        body:
          'When no damage opportunity is available, send healing toward allies who are about to peek or engage so the sustain arrives with the incoming damage.',
      },
      {
        title: 'Enable the active win condition',
        body:
          'When an ally commits a powerful ultimate or takes a fight-winning angle, prioritize their survival and resources. The Strategist’s invisible contribution can be the reason the visible carry succeeds.',
      },
      {
        title: 'Use output for the current state',
        body:
          'Heal during enemy ultimate pressure, add damage during friendly protection or a numbers advantage, and retreat when the effect keeping you safe is about to expire.',
      },
    ],
    decisionRules: [
      {
        when: 'Resurrection or team utility becomes available',
        action: 'Place it quickly in a varied, reachable location unless the fight demands immediate healing.',
      },
      {
        when: 'A teammate activates the play that can win the fight',
        action: 'Pre-heal, supply utility, and maintain line of sight on that player until the play resolves.',
      },
      {
        when: 'The enemy commits major sustain',
        action: 'Give space, heal the threatened squishies, and survive until the effect ends.',
      },
      {
        when: 'An enemy is isolated or critical and allies are stable',
        action: 'Add damage to finish the target instead of topping off safe teammates.',
      },
    ],
    checkpoints: [
      {
        time: '00:21',
        label: 'Low-downtime setup',
        note: 'Place the resurrection station quickly and return to the fight instead of hunting perfection.',
      },
      {
        time: '04:47',
        label: 'Proactive resource stack',
        note: 'Support utility and amplifier are committed early to secure the objective and restart the charge cycle.',
      },
      {
        time: '08:49',
        label: 'Know when healing cannot save the play',
        note: 'Maintain cover and avoid dying alongside an ally whose position has already collapsed.',
      },
      {
        time: '14:12',
        label: 'Enable the allied ultimate',
        note: 'Rocket becomes a dedicated healer for the teammate currently capable of deciding the fight.',
      },
      {
        time: '27:59',
        label: 'Prepare before protection ends',
        note: 'Use friendly sustain for damage, then move early to the position needed after it expires.',
      },
      {
        time: '33:20',
        label: 'Scoreboard context',
        note: 'Lower team healing still wins because the right players receive the right help at the right time.',
      },
    ],
    drills: [
      {
        title: 'Utility uptime',
        instructions:
          'Track every period when resurrection or equivalent persistent utility is available but not active.',
        success: 'Inactive time comes from a deliberate fight priority, not forgetting the cooldown.',
      },
      {
        title: 'Name the win condition',
        instructions:
          'Before each fight, identify the ally, ultimate, angle, or objective interaction most likely to decide it.',
        success: 'Your first healing and utility priority supports that win condition.',
      },
      {
        title: 'Effect-expiry rotation',
        instructions:
          'While a friendly sustain ultimate is active, choose where you will stand the instant it ends.',
        success: 'You leave the protected area safely instead of reacting after enemy damage resumes.',
      },
    ],
    reviewQuestions: [
      'How much time did I spend placing utility instead of contributing to the fight?',
      'Did I recognize and support the teammate who was currently winning the fight?',
      'Was my pre-healing aimed at predictable incoming pressure?',
      'Did I remain aggressive after the resource protecting me expired?',
    ],
  },
];
