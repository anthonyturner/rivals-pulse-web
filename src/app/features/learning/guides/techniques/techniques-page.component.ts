import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';

type TechniqueCategory =
  | 'All'
  | 'Fundamentals'
  | 'Roles'
  | 'Heroes'
  | 'Mindset'
  | 'VOD Reviews'
  | 'Analyses';

interface GuideLink {
  label: string;
  url: string;
}

interface TechniqueGuide {
  id: string;
  category: Exclude<TechniqueCategory, 'All'>;
  title: string;
  takeaway: string;
  practice: string;
  image: string;
  tags: string[];
  links: GuideLink[];
}

interface DiagramStep {
  label: string;
  note: string;
}

interface HeroWorkshop {
  hero: string;
  role: 'Vanguard' | 'Duelist' | 'Strategist';
  image: string;
  focus: string;
  links: GuideLink[];
}

interface RoleLibrary {
  role: string;
  heroes: string[];
}

@Component({
  selector: 'app-techniques-page',
  imports: [CommonModule],
  templateUrl: './techniques-page.component.html',
  styleUrl: './techniques-page.component.css',
})
export class TechniquesPageComponent {
  readonly categories: TechniqueCategory[] = [
    'All',
    'Fundamentals',
    'Roles',
    'Heroes',
    'Mindset',
    'VOD Reviews',
    'Analyses',
  ];

  readonly selectedCategory = signal<TechniqueCategory>('All');
  readonly searchTerm = signal('');

  readonly guides: TechniqueGuide[] = [
    {
      id: 'cover',
      category: 'Fundamentals',
      title: 'Strategic Cover Usage',
      takeaway:
        'Treat cover as your default state, not a panic button. Peek with a purpose, trade damage, then disappear before the enemy can fully answer.',
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
        'High ground is valuable when it changes enemy pathing, protects your resources, or lets you choose when the duel starts.',
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
        'Good rotations are not just shorter routes. They hide your timing, preserve cooldowns, and create a new problem for the enemy backline.',
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
        'A power position lets you pressure multiple lanes, retreat safely, and force enemies to look away from your team.',
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
        'A killbox is the space where multiple friendly angles overlap. The goal is to make the enemy walk into stacked pressure, not chase them alone.',
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
        'Lane control is about choosing where the enemy is allowed to stand. Uptime comes from holding useful pressure without overexposing.',
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
        'Timing turns pressure into a fight win. The best target is often the enemy who is isolated, cooldown-light, or already forced to look away.',
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
        'Vanguards carry by deciding where the fight happens. Your job is to take space your team can use, not simply stand on point.',
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
        'Duelists create threat before they create eliminations. Scouting, setup, and crossfire make the final burst much easier.',
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
        'Strategists carry by being proactive: stabilizing the right teammate, pressuring the right lane, and keeping utility for the enemy win condition.',
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
        'Mental discipline is mechanical discipline under pressure. The workbook groups autopilot, tilt, anxiety, and consistency as practice problems.',
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
        'Review should find repeatable causes, not single-frame blame. Look for setup, resource, timing, and target-selection patterns.',
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
        'The workbook includes OWL analysis material for engagement plans, spam and dive structures, brawl matchups, positioning, and resource management.',
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

  readonly diagrams: DiagramStep[] = [
    { label: 'Stage', note: 'Start near cover with an exit and a teammate who can trade.' },
    { label: 'Pressure', note: 'Open an angle that forces attention without spending every cooldown.' },
    { label: 'Collapse', note: 'Commit when the target is isolated, low-resource, or looking away.' },
    { label: 'Reset', note: 'Leave before the counter-engage turns your good angle into a trap.' },
  ];

  readonly heroWorkshops: HeroWorkshop[] = [
    {
      hero: 'Thor',
      role: 'Vanguard',
      image: '/images/heroes/thor.png',
      focus: 'Positioning, engagement timing, and backline pressure.',
      links: [
        { label: 'Thor guide', url: 'https://youtu.be/fFMfUcDSyCw?si=NtJ5C2ogdBx4NnEg' },
        { label: 'Backline pressure', url: 'https://youtu.be/4bpZdcmki_U?si=xrFvRkQ6MPBx9KBM' },
      ],
    },
    {
      hero: 'Rocket Raccoon',
      role: 'Strategist',
      image: '/images/heroes/rocket-raccoon.png',
      focus: 'Angle control, mobility routes, and support uptime.',
      links: [
        { label: 'Power of angles', url: 'https://youtu.be/F8hgSt10t_U?si=yVm3ZIM77CwD9FmX' },
        { label: 'Mobility review', url: 'https://youtu.be/sFS0hdczwWM?si=R66GxtbYCjJWExvr' },
      ],
    },
    {
      hero: 'Magneto',
      role: 'Vanguard',
      image: '/images/heroes/magneto.png',
      focus: 'Dynamic positioning, bubble timing, target priority, and map control.',
      links: [
        { label: 'Stop playing point', url: 'https://youtu.be/9Whi3bO36Mk?si=_FtR2RxrzaCP9O8C' },
        { label: 'Target priority', url: 'https://youtu.be/D_UzF_87l0k?si=U3XY66DBpAbaLExw' },
      ],
    },
    {
      hero: 'Jeff the Land Shark',
      role: 'Strategist',
      image: '/images/heroes/jeff-the-land-shark.png',
      focus: 'Space control, lane support, and stabilizing pressure.',
      links: [{ label: 'Strategist masterclass', url: 'https://youtu.be/veOh-WKr4Xw?si=_s1DeN9iMPJtgUh7' }],
    },
    {
      hero: 'Invisible Woman',
      role: 'Strategist',
      image: '/images/heroes/invisible-woman.png',
      focus: 'Sharp sightlines, resource management, and angle control.',
      links: [
        { label: 'Support effectively', url: 'https://youtu.be/-iBssvJkLXk?si=TdK-KchPCqEkt_Fb' },
        { label: 'Resources', url: 'https://youtu.be/Svs5zEB2JL8?si=26ga21tr8pssipf6' },
      ],
    },
    {
      hero: 'Star-Lord',
      role: 'Duelist',
      image: '/images/heroes/star-lord.png',
      focus: 'Scouting, setup, duelist timing, and poke-to-burst conversion.',
      links: [
        { label: 'Scout and setup', url: 'https://youtu.be/YX2xq2RXV7o?si=1SxRqhS7w1LB4B6E' },
        { label: 'Duelist masterclass', url: 'https://www.youtube.com/watch?v=6FGNkCvqhgA' },
      ],
    },
  ];

  readonly roleLibrary: RoleLibrary[] = [
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

  readonly filteredGuides = computed(() => {
    const category = this.selectedCategory();
    const searchTerm = this.searchTerm().trim().toLowerCase();

    return this.guides.filter((guide) => {
      const matchesCategory = category === 'All' || guide.category === category;
      const matchesSearch =
        searchTerm.length === 0 ||
        guide.title.toLowerCase().includes(searchTerm) ||
        guide.takeaway.toLowerCase().includes(searchTerm) ||
        guide.practice.toLowerCase().includes(searchTerm) ||
        guide.tags.some((tag) => tag.toLowerCase().includes(searchTerm));

      return matchesCategory && matchesSearch;
    });
  });

  readonly sourceCount = computed(() =>
    this.guides.reduce((total, guide) => total + guide.links.length, 0) +
    this.heroWorkshops.reduce((total, workshop) => total + workshop.links.length, 0),
  );

  selectCategory(category: TechniqueCategory): void {
    this.selectedCategory.set(category);
  }

  updateSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm.set(input.value);
  }
}
