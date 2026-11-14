import type { StrategistGuideArticle } from './strategist-guide-article.types';

export const STRATEGIST_ARTICLES: Readonly<Record<string, StrategistGuideArticle>> = {
  'carrying-with-confidence': {
    introduction: 'Confidence comes from reading what the fight permits. Begin with a position that lets you heal without sharing every angle aimed at the frontline. From there, an elimination, a spent enemy cooldown or a friendly ultimate can give you permission to move. The same awareness tells you when to stop: aggression that was useful a moment ago becomes a stagger when your team loses the players supporting it.',
    exampleTitle: 'Hypothetical example: the first elimination creates a window',
    example: [
      'Your team gets the opening elimination while the frontline is healthy. Move to the next covered position with them and look for damage or crowd control on an exposed enemy. You are using the advantage to shorten the fight rather than remaining behind to heal harmless missing health.',
      'Now a diver reaches you. The damage window has changed, even though your team still has more players. Protect yourself, rotate toward safety and resume team healing when the immediate threat is controlled. The lesson is to update the decision, not to treat the first elimination as permanent permission to attack.',
    ],
    practice: 'For one match, say forward, hold or back after each elimination. Review the first occasion your movement disagreed with the call, then check whether cover or a nearby threat justified the difference.',
  },
  'ult-efficiency-101': {
    introduction: 'An ultimate is useful when it changes what happens next. That may mean preserving point control, moving the payload, keeping a necessary defender alive or converting a numbers advantage. Waiting for the most impressive counter can cost the objective and the opportunity to charge another ultimate. Decide what result you need before deciding whether the cast looks perfect.',
    exampleTitle: 'Hypothetical example: protect the objective advantage',
    example: [
      'Your team owns the Domination point but the defense is starting to break. A support ultimate that preserves control can buy percentage and avoid a harder retake. Judge it by the control it protects, rather than waiting for a particular enemy ultimate to make the decision for you.',
      'Check the other Strategist before spending. If their active ultimate already provides enough protection, save the next layer and say what will trigger it. If it does not, fear of overlap should not keep you watching a preventable collapse. The comparison is between actual outcomes, not an absolute rule to spend or hold.',
    ],
    practice: 'At roughly 90% charge, name the next condition that would make you use the ultimate. After the fight, write down the objective time, space or teammate survival it actually bought.',
  },
  'rocket-to-celestial': {
    introduction: 'Rocket carries by staying involved. Useful wall routes, healing geometry and reachable resurrection coverage keep his contribution running while enemies spend time trying to remove him. Once that foundation is secure, his backline view becomes information for the team: who should retreat, where a flank is forming and when an amplifier can turn one opening into objective control.',
    exampleTitle: 'Hypothetical example: survive the dive without losing the fight',
    example: [
      'Before the fight, choose a wall route and a healing angle that reaches teammates without exposing you to the main damage lane. When a diver approaches, use that route instead of discovering your escape after the combo starts. Surviving keeps your healing, resurrection coverage and calls available.',
      'If your team then earns the first elimination, advance to another safe position and consider amplifier to secure the advantage. A covered or elevated placement should reach teammates while making the enemy choose between shooting it and looking at the fight. Do not turn a successful escape into an unsupported chase.',
    ],
    practice: 'Choose a forward route, a retreat route and a reachable resurrection position before the first fight. Review whether a death came from the route itself, its timing or staying after the safe window ended.',
  },
  'holding-strategist-ults': {
    introduction: 'Holding an ultimate is a decision with a cost. On an owned objective, using it now can preserve percentage or connect the defense to returning teammates. Holding it may create a retake that costs another fight. The important distinction is between a stall that reaches real reinforcements and a cast that merely delays an already finished fight.',
    exampleTitle: 'Hypothetical example: a stall with a real handoff',
    example: [
      'You are down players on a Domination point, but a teammate can return during your ultimate. Check the respawn timing and remaining objective progress. If the protection bridges that gap and preserves control, the cast has a purpose beyond the current elimination count.',
      'Change the situation: nobody can return in time and no useful objective time remains. The same ultimate would now prolong a lost fight. Reset for a coordinated retake. Calling the expected handoff makes the difference visible to the team and helps avoid piling both support ultimates into the same brief window.',
    ],
    practice: 'Before a disadvantaged stall, identify who can actually return during the effect. In the replay, check whether the cast reached that teammate or simply postponed your death.',
  },
  'rocket-guide-part-2-damage': {
    introduction: 'Rocket should not choose between being a healer and being a damage player before the match starts. The fight supplies the choice repeatedly. Stable allies, friendly sustain or an isolated enemy can open a damage window; a threatened teammate can close it immediately. The target also matters: removing a deployable or the one enemy contesting may do more than adding damage to a hero who cannot be finished.',
    exampleTitle: 'Hypothetical example: spend the safe window on the obstacle',
    example: [
      'A friendly support ultimate is active and your teammates are stable. Before shooting the nearest enemy, identify what is preventing progress. If a deployable is maintaining the enemy position, clearing it can leave the team a better fight after the sustain window ends.',
      'In overtime, that priority can become the single enemy stalling the objective. Keep the damage on the obstacle instead of leaving for an unrelated low-health target. Return to healing as soon as an ally is under real pressure; a damage window is a temporary condition, not a commitment to finish the clip.',
    ],
    practice: 'Before each deliberate damage attempt, name two reasons it is safe and the target that would change the objective fight. Review whether either condition disappeared while you kept shooting.',
  },
  'rocket-guide-part-1-potential': {
    introduction: 'Rocket’s mechanical ceiling begins with the route beside his healing position. A useful wall can support movement, improve the angle of healing orbs and give him a way out when pressure arrives. Practice that relationship before chasing a complicated rollout: better movement should reduce downtime and preserve resources for the fight you are returning to.',
    exampleTitle: 'Hypothetical example: prepare the exit before the healing angle',
    example: [
      'A grouped frontline needs healing beyond a corner. Choose nearby geometry that lets orbs pass through or bounce into several teammates while leaving a usable wall route behind you. Test the collision before relying on it; an irregular surface can interrupt the movement you expected.',
      'When pressure reaches the position, use the planned wall-assisted route instead of spending every movement charge on a flat escape. After recovering, establish the next healing angle and resurrection coverage. The purpose of the technique is continued support, not distance travelled for its own sake.',
    ],
    practice: 'Practise one reliable wall-assisted escape and one multi-ally healing angle on the next map. In the match, check whether you can use both without stepping into the frontline’s damage lane.',
  },
  'strategist-positioning-vs-dive': {
    introduction: 'Anti-dive play begins before the attacker arrives. A missing flanker, a predictable approach and an unsuitable piece of cover all give you information while you still have time to move. Your first task is to survive the strongest burst. Once those abilities are spent, pressure can make the diver leave, and the time they wasted chasing you becomes value for your team.',
    exampleTitle: 'Hypothetical example: make the missing flanker change course',
    example: [
      'A dive hero disappears from the main fight. Warn your other Strategist and move toward a planned exit rather than waiting in the same exposed position. Choose cover for that hero’s movement; high ground is not automatically safe against an aerial approach.',
      'When the burst begins, break the sightline and use survival tools instead of trying to win a damage race during the attacker’s strongest moment. If they remain after spending those abilities, answer with damage or control from cover. A forced retreat can be a successful defense even without an elimination.',
    ],
    practice: 'Each time a flanker leaves view, perform a scan and identify an exit before returning to the frontline. Review whether your first movement happened before contact or only after the burst landed.',
  },
  'win-through-better-positioning': {
    introduction: 'Useful distance is a relationship, not a fixed spot at the back of the map. Stay close enough to heal and receive help, while making a flanker cross controlled space to reach you. Move that distance with the frontline. Cover and early retreat reduce the extra angles that turn an otherwise survivable hit into a death.',
    exampleTitle: 'Hypothetical example: follow the advance without sharing its danger',
    example: [
      'Your frontline moves after a pick. Take the next safe position with them, leaving a gap and an exit instead of standing in the same incoming angle. You remain useful without making one enemy shot threaten both the tank and the Strategist.',
      'The enemy answers with sustain your team cannot overcome. Give space early while keeping allies in range. If one teammate takes an isolated position with no safe route for you, call the problem rather than turning their mistake into a second death. Re-enter when the effect and the fight state permit it.',
    ],
    practice: 'At each death, count the enemy angles that could damage you and note when the frontline began retreating. Focus the next match on moving one safe position earlier.',
  },
  'heal-vs-damage': {
    introduction: 'A health bar shows missing health; it does not tell you who is in the most danger. Combine it with cover, enemy attention, available escapes and the speed of the lobby’s damage. Cloak & Dagger illustrate why this matters: healing and pressure are parts of one cycle, and either can be the wrong action when you keep doing it after the situation changes.',
    exampleTitle: 'Hypothetical example: two health bars, two different risks',
    example: [
      'A damaged teammate is safe behind cover while a healthier ally is being focused in the open. Prioritize the immediate danger instead of sorting teammates only by missing health. Once that threat is stable, a vulnerable enemy or deployable can make pressure the useful next action.',
      'If a diver then commits to you, protect yourself and fight back while the frontline self-manages. Return to team healing when you are safe. These transitions use the whole kit; they do not justify ignoring healing needs or staying in a pressure form throughout a fight.',
    ],
    practice: 'Before switching to damage, check health, cover, enemy attention and defensive tools. Review one switch that went well and one that did not, naming the danger information you had at the time.',
  },
  'support-and-carry': {
    introduction: 'Reliable support is a loop: prepare useful utility, anticipate pressure, recognize the teammate creating the winning play and change output as the fight changes. The details connect. Time spent searching for a perfect deployable is time without healing or pressure, and protection that made an aggressive position safe will eventually expire.',
    exampleTitle: 'Hypothetical example: support the play, then prepare the exit',
    example: [
      'A teammate commits the ultimate or angle most likely to win the fight. Maintain their sightline, pre-heal predictable incoming pressure and supply useful utility. Your contribution may not earn the final hit, but it keeps the winning action possible.',
      'While friendly protection is active, choose where you will stand when it ends. If the enemy commits major sustain, give space and keep threatened teammates alive instead of continuing the earlier aggression. Resume damage when allies are stable and a relevant target becomes available.',
    ],
    practice: 'Name the expected win condition before each fight and the position you will use after friendly protection expires. Review whether your first healing and utility decisions supported that plan.',
  },
};
