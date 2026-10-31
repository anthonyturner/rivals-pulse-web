import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FirstTimeGuideSection {
  title: string;
  summary: string;
  points: string[];
}

@Component({
  selector: 'app-first-time-guide-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './first-time-guide-page.component.html',
  styleUrl: './first-time-guide-page.component.css',
})
export class FirstTimeGuidePageComponent {
  readonly sections: FirstTimeGuideSection[] = [
    {
      title: 'What kind of game is this?',
      summary:
        'Marvel Rivals is a team hero shooter: you win by combining hero abilities, positioning, timing, and objective control.',
      points: [
        'You are not trying to win six separate duels. You are trying to help your team take a better fight than the enemy team.',
        'Every hero has a job. Some heroes make space, some create damage pressure, and some keep teammates alive while adding utility.',
        'Objectives decide the round, but fights decide whether your team can safely control those objectives.',
        'A good first goal is simple: stay alive, fight with teammates, use cover, and learn what your hero is supposed to do.',
      ],
    },
    {
      title: 'Pick a role before you worry about a main',
      summary:
        'Roles give you a starting job so the match feels less chaotic while you are learning heroes.',
      points: [
        'Vanguards are the front line. They help the team move through dangerous space, hold important areas, and absorb or block pressure at key moments.',
        'Duelists create threat. They pressure enemies from main lanes, side angles, or high ground, then finish targets when the enemy is distracted or weak.',
        'Strategists stabilize the team. They heal, protect, use utility, and still look for safe damage or pressure when teammates are healthy.',
        'If you are brand new, try a few heroes in each role, then choose one role to learn for a session so your decisions have a clear theme.',
      ],
    },
    {
      title: 'Your first match plan',
      summary:
        'Do not try to master every system at once. Use a small loop that works on every map and every role.',
      points: [
        'Before the fight starts, find your team and identify the path most players are taking.',
        'Choose cover before you shoot. If the enemy looks at you, you should already know where you will hide.',
        'Enter fights when your team can also fight. Going in alone is the fastest way to feel like the game is unfair.',
        'After a death, regroup. Running back into the enemy one by one gives them free progress and delays your next real team fight.',
      ],
    },
    {
      title: 'How team fights work',
      summary:
        'Most fights are won when pressure overlaps and lost when players trickle in at different times.',
      points: [
        'A fight usually starts with both teams poking, rotating, and looking for a better angle.',
        'The real fight begins when one team commits cooldowns, takes space, dives a target, or touches the objective.',
        'If your team gets the first elimination, move carefully forward and help finish the fight without chasing too far.',
        'If your team loses two or more players early, back up unless the round is about to end. Living for the next fight is usually better than dying late.',
      ],
    },
    {
      title: 'Positioning basics',
      summary:
        'Good positioning makes the game slower, cleaner, and much easier to understand.',
      points: [
        'Play near cover. Cover lets you stop taking damage without needing a cooldown or a healer to save you.',
        'Use high ground when you can. It gives better sightlines, safer exits, and more control over when you drop into a fight.',
        'Avoid standing in the middle of open lanes. If multiple enemies can see you at once, you are probably too exposed.',
        'Know your exit before you commit. A bad engage with an escape is a lesson; a bad engage with no escape is a respawn timer.',
      ],
    },
    {
      title: 'Target priority for beginners',
      summary:
        'You do not need a perfect target chart. You need to shoot the problem your team can actually punish.',
      points: [
        'Shoot enemies who are low, isolated, out of cover, or missing movement and defensive cooldowns.',
        'Do not tunnel the tank forever if the enemy Strategists are freely healing them and your team is making no progress.',
        'If an enemy dives your backline, helping your Strategists survive may be more valuable than chasing a distant target.',
        'When unsure, shoot the same target as a teammate. Shared pressure is easier to convert than scattered damage.',
      ],
    },
    {
      title: 'Ultimates and cooldowns',
      summary:
        'Abilities are strongest when they answer a real problem instead of being pressed the moment they light up.',
      points: [
        'Use cooldowns for a reason: to take space, survive pressure, save a teammate, secure a target, or escape.',
        'Do not spend every ability before the fight starts. If the enemy pushes after your tools are gone, you have fewer answers.',
        'Ultimates are fight-winning tools, but they still need timing. Use them when teammates can follow up or when they stop the enemy win condition.',
        'It is okay to make messy ultimate mistakes early. After each one, ask whether your team was ready and whether the enemy had an easy answer.',
      ],
    },
    {
      title: 'What to focus on after the match',
      summary:
        'Improvement is faster when you review one repeatable habit instead of trying to fix everything.',
      points: [
        'Pick one death and ask what happened before it: bad route, no cover, early engage, no cooldown, or fighting without teammates.',
        'Choose one cue for the next match, such as cover first, wait for team, save escape, or shoot with a teammate.',
        'Do not judge progress only by wins. A new player can lose while making much better decisions than the match before.',
        'Once the basics feel less chaotic, move into hero guides, learning paths, and the interactive beginner guide for more specific practice.',
      ],
    },
  ];

  readonly quickRules = [
    'Fight with teammates.',
    'Use cover before damage.',
    'Reset after lost fights.',
    'Spend cooldowns with a purpose.',
    'Shoot targets your team can punish.',
  ];
}
